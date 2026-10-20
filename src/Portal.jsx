import {
  passwordInputProps,
  passwordRequirements,
} from "./ui/lib/password-policy";
import { NoticeBell, Home, Stock, FinancePanel, Rates } from "./Ecosystem";
import { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowLeft,
  Camera,
  CheckCheck,
  ClipboardList,
  Download,
  LogOut,
  MapPin,
  RefreshCw,
  Send,
  Trash2,
  Package,
  KeyRound,
  Wallet,
  CircleDollarSign,
} from "lucide-react";
import { api, errorMessage, saveToken } from "@zenfield/ui/lib/api";
import { useSession } from "@zenfield/ui/lib/session";
import { notify, confirmAction } from "@zenfield/ui/lib/feedback";

import AppFooter from "@zenfield/ui/components/AppFooter";
import {
  Badge,
  Loading,
  Empty,
  format,
  FormModal,
  download,
} from "@zenfield/ui/components/service-common";
import { EvidencePhoto } from "@zenfield/ui/components/ServiceEvidence";
async function compressedImage(file) {
  if (!file.type.startsWith("image/")) throw Error("Escolha uma imagem.");
  if (file.size > 24 * 1024 * 1024) throw Error("Use uma foto de até 24 MB.");
  const uri = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = uri;
    await image.decode();
    const scale = Math.min(
        1,
        2400 / Math.max(image.naturalWidth, image.naturalHeight),
      ),
      canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.9);
  } finally {
    URL.revokeObjectURL(uri);
  }
}
function FileButtons({ disabled, checklist = false, onFile }) {
  function selected(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) onFile(file);
  }
  return (
    <div className="portal-file-buttons">
      <label className={"primary-button " + (disabled ? "is-disabled" : "")}>
        <Camera size={19} />
        Tirar foto
        <input
          aria-label={
            checklist ? "Fotografar checklist assinado" : "Tirar foto"
          }
          type="file"
          accept="image/*"
          capture="environment"
          disabled={disabled}
          onChange={selected}
        />
      </label>
      <label className={"secondary-button " + (disabled ? "is-disabled" : "")}>
        <Download size={17} />
        {checklist ? "Anexar PDF ou foto" : "Escolher foto"}
        <input
          aria-label={checklist ? "Anexar checklist assinado" : "Escolher foto"}
          type="file"
          accept={checklist ? "application/pdf,image/*" : "image/*"}
          disabled={disabled}
          onChange={selected}
        />
      </label>
    </div>
  );
}
async function uploadData(file, checklist) {
  if (
    checklist &&
    (file.type === "application/pdf" || /\.pdf$/i.test(file.name))
  ) {
    if (file.size > 8 * 1024 * 1024) throw Error("Escolha um PDF de até 8 MB.");
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () =>
        reject(Error("Não foi possível abrir o arquivo. Escolha-o novamente."));
      reader.readAsDataURL(file);
    });
  }
  return compressedImage(file);
}
function Service({ id, onBack, onChanged }) {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [notes, setNotes] = useState(""),
    [executedOn, setExecutedOn] = useState(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date()),
    ),
    [confirmed, setConfirmed] = useState(false),
    [signed, setSigned] = useState(false),
    [uploadStatus, setUploadStatus] = useState(""),
    [equipmentFeedback, setEquipmentFeedback] = useState(null),
    [retry, setRetry] = useState(null);
  const loadedBatch = useRef(null);
  async function reload() {
    const { data: next } = await api.get(
      "/technician/orders/" + encodeURIComponent(id),
    );
    setData(next);
    const active = next.submissions.find((b) =>
      ["draft", "submitted", "approved_sync", "stock_failed"].includes(b.state),
    );
    if (active?.id !== loadedBatch.current) {
      loadedBatch.current = active?.id;
      setNotes(active?.notes || "");
      setExecutedOn(
        active?.executed_on ||
          next.order.executed_on ||
          new Intl.DateTimeFormat("en-CA", {
            timeZone: "America/Sao_Paulo",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(new Date()),
      );
      setConfirmed(false);
      setSigned(active?.checklist_signed || false);
    }
    return next;
  }
  useEffect(() => {
    reload().catch((e) => setError(errorMessage(e)));
  }, [id]);
  useEffect(() => {
    if (!data || data.submissions.some((b) => b.state === "draft")) return;
    const timer = setInterval(() => {
      if (!document.hidden && !busy) reload().catch(() => {});
    }, 15000);
    return () => clearInterval(timer);
  }, [data, busy]);
  async function act(fn) {
    setBusy(true);
    setError("");
    try {
      await fn();
      await reload();
      onChanged();
    } catch (e) {
      setError(e.response ? errorMessage(e) : e.message || errorMessage(e));
      // Recover the current version after a response is lost; saved photos remain visible.
      await reload().catch(() => {});
    } finally {
      setBusy(false);
      setUploadStatus("");
    }
  }
  if (!data)
    return (
      <>
        <button className="secondary-button" onClick={onBack}>
          <ArrowLeft size={16} />
          Meus serviços
        </button>
        <Loading error={error} />
      </>
    );
  const { order, document: doc, rule, submissions } = data;
  const batch = submissions.find((b) =>
    ["draft", "submitted", "approved_sync", "stock_failed"].includes(b.state),
  );
  const draft = batch?.state === "draft",
    closed = ["CONCLUÍDO", "CANCELADO"].includes(order.status);
  const rejected = submissions.find((b) => b.state === "rejected");
  const files = batch?.files || [],
    stale = draft && batch.order_version !== order.version;
  const install = rule.stock_action === "install";
  const codes = [
    ...new Set(
      files
        .filter((f) => f.kind === "label" && f.serial_code)
        .map((f) => f.serial_code),
    ),
  ];
  const needsChecklist = !batch || batch.capture_version >= 2;
  const generalFiles = files.filter(
    (f) => !["label", "checklist"].includes(f.kind),
  );
  const generalMinimum = needsChecklist
    ? (rule.general_photo_min ?? 1)
    : rule.required_photos
        .filter((r) => !["label", "checklist"].includes(r.kind))
        .reduce((n, r) => n + r.min, 0);
  const missing = rule.required_photos
    .filter(
      (r) =>
        ["label", "checklist"].includes(r.kind) &&
        files.filter((f) => f.kind === r.kind).length < r.min,
    )
    .map((r) => r.label);
  if (generalFiles.length < generalMinimum)
    missing.push(
      `Fotos do atendimento (${generalFiles.length}/${generalMinimum})`,
    );
  if (
    needsChecklist &&
    !files.some((f) => f.kind === "checklist") &&
    !missing.includes("Checklist assinado")
  )
    missing.push("Checklist assinado");
  if (install && codes.length < rule.min_serials)
    missing.push("Foto legível do equipamento");
  if (install && needsChecklist)
    for (const [type, min] of Object.entries(data.required_equipment || {})) {
      const received = new Set(
        files
          .filter((f) => f.kind === "label" && f.equipment_type === type)
          .map((f) => f.serial_code),
      );
      if (received.size < min)
        missing.push(
          `${min} ${type === "TAG" ? "TAG(s)" : "rastreador(es)"} previsto(s) na OS`,
        );
    }
  if (needsChecklist && !signed)
    missing.push("Confirmar assinatura do checklist");
  async function addFile(file, kind) {
    setRetry({ file, kind });
    await act(async () => {
      setUploadStatus(
        kind === "label"
          ? "Lendo o código e identificando o equipamento…"
          : "Enviando arquivo…",
      );
      if (kind === "label")
        setEquipmentFeedback({
          status: "reading",
          message: "Lendo o código de barras ou QR Code…",
        });
      try {
        const image = await uploadData(file, kind === "checklist");
        const { data: result } = await api.post(
          "/technician/batches/" + batch.id + "/photos",
          {
            version: batch.version,
            ...(kind === "other" ? {} : { kind }),
            image,
          },
          { timeout: 120000 },
        );
        setRetry(null);
        setConfirmed(false);
        const message = result.serial_code
          ? (result.equipment_type === "TAG"
              ? "TAG identificada: "
              : "Rastreador identificado · IMEI/serial: ") + result.serial_code
          : "Arquivo recebido.";
        if (kind === "label")
          setEquipmentFeedback({ status: "success", message });
        notify(message);
      } catch (e) {
        if (kind === "label")
          setEquipmentFeedback({
            status: "error",
            message: e.response
              ? errorMessage(e)
              : e.message || errorMessage(e),
          });
        throw e;
      }
    });
  }
  function photos(kind) {
    return (
      <div className="zc-evidence-grid">
        {files
          .filter((f) =>
            kind === "other"
              ? !["label", "checklist"].includes(f.kind)
              : f.kind === kind,
          )
          .map((f) => (
            <EvidencePhoto key={f.id} file={f}>
              <button
                className="secondary-button"
                disabled={busy || stale}
                onClick={() =>
                  act(async () => {
                    await api.delete("/technician/photos/" + f.id, {
                      data: { version: batch.version },
                    });
                    setConfirmed(false);
                  })
                }
              >
                <Trash2 size={14} />
                Remover
              </button>
            </EvidencePhoto>
          ))}
      </div>
    );
  }
  return (
    <div className="portal-service">
      <button className="secondary-button" disabled={busy} onClick={onBack}>
        <ArrowLeft size={16} />
        Meus serviços
      </button>
      <section className="dashboard-panel portal-service-summary">
        <div>
          <p className="portal-eyebrow">{order.id}</p>
          <h1>{order.vehicle}</h1>
          <p>
            {order.service} · {order.customer_name || "Associado"}
          </p>
        </div>
        <Badge value={order.status} />
        {order.tracker_waiver_authorized && (
          <div className="zc-notice">
            <b>Dispensa de rastreador autorizada</b>
            <p>
              Cliente autorizado a permanecer sem rastreador. Esta OS não
              integra sua remuneração, incluindo adicionais e ajustes. Registre
              a vistoria e o checklist assinado para conferência da central.
            </p>
          </div>
        )}
        <dl>
          <div>
            <dt>Agendamento</dt>
            <dd>{format(order.scheduled_at, true)}</dd>
          </div>
          <div>
            <dt>Contato</dt>
            <dd>{order.contact || "Não informado"}</dd>
          </div>
          <div>
            <dt>Local</dt>
            <dd>{order.location || "A confirmar"}</dd>
          </div>
        </dl>
        {doc && (
          <details className="portal-full-order" open>
            <summary>Ordem de serviço completa</summary>
            <dl>
              {[
                ["Associado", doc.customer.name],
                ["Endereço do associado", doc.customer.address],
                ["Documento", doc.customer.document],
                ["RG", doc.customer.rg],
                ["Placa", doc.vehicle.plate],
                ["Chassi", doc.vehicle.chassis],
                ["Renavam", doc.vehicle.renavam],
                [
                  "Marca / modelo",
                  [doc.vehicle.brand, doc.vehicle.model]
                    .filter(Boolean)
                    .join(" / "),
                ],
                ["Ano", doc.vehicle.year],
                [
                  "Tipo / categoria",
                  [doc.vehicle.type, doc.vehicle.category]
                    .filter(Boolean)
                    .join(" / "),
                ],
                ["Técnico", doc.technician],
                ["Serviço", doc.service],
              ]
                .filter(([, value]) => value)
                .map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
            </dl>
            <p className="zc-comments">{doc.instructions}</p>
          </details>
        )}
        <button
          type="button"
          className="secondary-button"
          disabled={busy}
          onClick={() =>
            download(
              "/technician/orders/" + encodeURIComponent(id) + "/pdf",
              id + ".pdf",
            ).catch((e) => setError(errorMessage(e)))
          }
        >
          <Download size={16} />
          Baixar OS em PDF
        </button>
      </section>
      {error &&
        !(retry?.kind === "label" && equipmentFeedback?.status === "error") && (
          <div className="error-banner" role="alert">
            {error}
            {retry && draft && !stale && (
              <button
                className="secondary-button"
                disabled={busy}
                onClick={() => addFile(retry.file, retry.kind)}
              >
                Tentar enviar novamente
              </button>
            )}
          </div>
        )}
      {busy && (
        <div className="zc-notice" role="status" aria-live="polite">
          {uploadStatus || "Salvando…"} Aguarde nesta tela.
        </div>
      )}
      {rejected && !closed && (!batch || draft) && (
        <div className="zc-notice amber">
          <b>O que precisa corrigir</b>
          <p>{rejected.rejection_reason}</p>
        </div>
      )}
      {batch && !draft && (
        <div className="zc-notice">
          <CheckCheck size={24} />
          <div>
            <b>
              {batch.state === "submitted"
                ? "Confirmação pendente"
                : "Aguardando confirmação do estoque"}
            </b>
            <p>
              Recebemos seus arquivos. A central fará a conferência. O serviço
              só entra no fechamento de pagamento depois da conclusão
              confirmada.
            </p>
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() => act(async () => {})}
            >
              <RefreshCw size={16} />
              Atualizar situação
            </button>
          </div>
        </div>
      )}
      {closed && (
        <div className="zc-notice">
          <CheckCheck size={24} />
          {order.status === "CONCLUÍDO"
            ? "Serviço confirmado. Disponível para o fechamento e pagamento pela central."
            : "Atendimento cancelado."}
        </div>
      )}
      {!batch && !closed && (
        <section className="dashboard-panel portal-step">
          <h2>Vamos registrar o serviço?</h2>
          <p>
            Envie as fotos e o checklist assinado. Cada arquivo fica salvo assim
            que for recebido.
          </p>
          <button
            className="primary-button"
            disabled={busy}
            onClick={() =>
              act(() =>
                api.post(
                  "/technician/orders/" + encodeURIComponent(id) + "/draft",
                  { version: order.version },
                ),
              )
            }
          >
            <Camera size={20} />
            Começar registro
          </button>
        </section>
      )}
      {draft && (
        <>
          {stale && (
            <div className="zc-notice amber">
              A OS foi alterada pela central. Descarte este rascunho e comece
              novamente para usar os dados atualizados.
            </div>
          )}
          <div className="portal-progress" aria-label="Etapas do registro">
            {[
              "Fotos do serviço",
              ...(install ? ["Equipamentos"] : []),
              "Checklist",
              "Enviar",
            ].map((step, i) => (
              <span key={step}>
                <b>{i + 1}</b>
                {step}
              </span>
            ))}
          </div>
          <section className="dashboard-panel portal-step">
            <div className="portal-step-title">
              <span>1</span>
              <div>
                <h2>Fotos do serviço e da vistoria</h2>
                <p>
                  Use os botões abaixo. Confira se as fotos ficaram nítidas.
                </p>
              </div>
            </div>
            <div className="portal-capture-group">
              <h3>Fotos do atendimento</h3>
              <p>
                {generalFiles.length} recebida(s) · Mínimo: {generalMinimum}.
                Adicione as fotos do veículo, do serviço e da vistoria juntas,
                sem escolher categoria.
              </p>
              <FileButtons
                disabled={busy || stale}
                onFile={(file) => addFile(file, "other")}
              />
              {photos("other")}
            </div>
          </section>
          {install && (
            <section className="dashboard-panel portal-step">
              <div className="portal-step-title">
                <span>2</span>
                <div>
                  <h2>Foto do rastreador ou da TAG</h2>
                  <p>
                    Uma foto por equipamento, mostrando toda a etiqueta com o
                    código de barras ou QR Code. O leitor identifica o IMEI do
                    rastreador ou o serial da TAG e confere com sua carga no
                    EstoquePro. Se a leitura falhar ou o código não
                    corresponder, avisaremos aqui e a foto não será aceita como
                    equipamento identificado.
                  </p>
                </div>
              </div>
              <FileButtons
                disabled={busy || stale}
                onFile={(file) => addFile(file, "label")}
              />
              {equipmentFeedback && (
                <div
                  className={
                    equipmentFeedback.status === "error"
                      ? "error-banner"
                      : "zc-notice"
                  }
                  role={
                    equipmentFeedback.status === "error" ? "alert" : "status"
                  }
                  aria-live={
                    equipmentFeedback.status === "error"
                      ? "assertive"
                      : "polite"
                  }
                >
                  <strong>
                    {equipmentFeedback.status === "error"
                      ? "Equipamento não identificado"
                      : equipmentFeedback.status === "reading"
                        ? "Identificando equipamento"
                        : "Leitura confirmada"}
                  </strong>
                  <p>{equipmentFeedback.message}</p>
                  {equipmentFeedback.status === "error" && (
                    <p>
                      Confira a etiqueta, evite reflexos e envie uma nova foto
                      nítida de um único equipamento.
                    </p>
                  )}
                </div>
              )}
              {photos("label")}
              {!codes.length && (
                <p className="zc-muted">
                  Nenhum equipamento identificado ainda.
                </p>
              )}
            </section>
          )}
          <section className="dashboard-panel portal-step">
            <div className="portal-step-title">
              <span>{install ? 3 : 2}</span>
              <div>
                <h2>Checklist preenchido e assinado</h2>
                <p>
                  Anexe seu formulário em PDF ou fotografe todas as páginas. A
                  central confere o conteúdo e a assinatura.
                </p>
              </div>
            </div>
            <FileButtons
              checklist
              disabled={busy || stale}
              onFile={(file) => addFile(file, "checklist")}
            />
            {photos("checklist")}
            <label className="zc-checkbox">
              <input
                type="checkbox"
                checked={signed}
                disabled={busy || stale}
                onChange={(e) => {
                  setSigned(e.target.checked);
                  setConfirmed(false);
                }}
              />
              O checklist anexado está preenchido e assinado.
            </label>
          </section>
          <section className="dashboard-panel portal-step">
            <div className="portal-step-title">
              <span>{install ? 4 : 3}</span>
              <div>
                <h2>Enviar para confirmação</h2>
                <p>Depois do envio, aguarde a conferência da central.</p>
              </div>
            </div>
            <label className="zc-field zc-full">
              Data efetiva da execução
              <input
                type="date"
                required
                value={executedOn}
                onChange={(e) => {
                  setExecutedOn(e.target.value);
                  setConfirmed(false);
                }}
                disabled={busy || stale}
              />
            </label>
            <label className="zc-field zc-full">
              Observações do atendimento (opcional)
              <textarea
                aria-label="Observações do atendimento (opcional)"
                rows={3}
                maxLength={6000}
                value={notes}
                disabled={busy || stale}
                onChange={(e) => {
                  setNotes(e.target.value);
                  setConfirmed(false);
                }}
              />
            </label>
            {missing.length ? (
              <div className="zc-notice amber">
                <div>
                  <b>Falta completar</b>
                  <ul>
                    {[...new Set(missing)].map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="zc-notice">
                Todos os arquivos obrigatórios foram recebidos.
              </div>
            )}
            <label className="zc-checkbox">
              <input
                type="checkbox"
                checked={confirmed}
                disabled={busy || stale || !!missing.length}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              Conferi a OS, as fotos e os equipamentos deste atendimento.
            </label>
            <div className="portal-submit-actions">
              <button
                className="secondary-button"
                disabled={busy || stale || !!missing.length}
                onClick={() =>
                  act(() =>
                    api.post("/technician/orders/" + order.id + "/finish", {
                      version: order.version,
                      executed_on: executedOn,
                    }),
                  )
                }
              >
                Registrar execução finalizada
              </button>
              <button
                className="primary-button"
                disabled={busy || stale || !!missing.length || !confirmed}
                onClick={() =>
                  act(async () => {
                    await api.post(
                      "/technician/batches/" + batch.id + "/submit",
                      {
                        version: batch.version,
                        serials: install ? codes : [],
                        checklist_signed: signed,
                        executed_on: executedOn,
                        notes,
                        confirmed,
                      },
                    );
                    setRetry(null);
                    notify(
                      "Arquivos enviados. Confirmação pendente da central.",
                    );
                  })
                }
              >
                <Send size={19} />
                {busy ? "Aguarde…" : "Enviar e aguardar confirmação"}
              </button>
              <button
                className="secondary-button"
                disabled={busy || stale}
                onClick={() =>
                  act(async () => {
                    await api.patch("/technician/batches/" + batch.id, {
                      version: batch.version,
                      serials: install ? codes : [],
                      checklist_signed: signed,
                      executed_on: executedOn,
                      notes,
                    });
                    notify("Rascunho salvo. Você pode continuar depois.");
                  })
                }
              >
                Salvar e continuar depois
              </button>
              <button
                className="secondary-button"
                disabled={busy}
                onClick={async () => {
                  if (
                    await confirmAction(
                      "Descartar este registro e começar novamente?",
                    )
                  )
                    act(() =>
                      api.post("/technician/batches/" + batch.id + "/discard", {
                        version: batch.version,
                      }),
                    );
                }}
              >
                Descartar registro
              </button>
            </div>
          </section>
        </>
      )}
      {!!submissions.filter((b) => b.state !== "draft").length && (
        <section className="dashboard-panel portal-history">
          <h2>Arquivos enviados</h2>
          {submissions
            .filter((b) => b.state !== "draft")
            .map((b) => (
              <details key={b.id}>
                <summary>
                  {format(b.submitted_at || b.reviewed_at, true)} ·{" "}
                  <Badge value={b.state} />
                </summary>
                {b.rejection_reason && <p>{b.rejection_reason}</p>}
                <div className="zc-evidence-grid">
                  {b.files.map((f) => (
                    <EvidencePhoto key={f.id} file={f} />
                  ))}
                </div>
              </details>
            ))}
        </section>
      )}
    </div>
  );
}
export default function TechnicianPortal({
  supervision,
  onChangeTechnician,
  trackingUrl,
}) {
  const user = useSession(),
    [items, setItems] = useState(null),
    [me, setMe] = useState(null),
    [error, setError] = useState(""),
    [selected, setSelected] = useState(null),
    [revision, setRevision] = useState(0),
    [filter, setFilter] = useState("open"),
    [password, setPassword] = useState(false),
    [area, setArea] = useState("home"),
    [criteria, setCriteria] = useState({
      q: "",
      vehicle: "",
      service: "",
      status: "",
      from: "",
      to: "",
    }),
    [page, setPage] = useState(1),
    [total, setTotal] = useState(0);
  const [searchCriteria, setSearchCriteria] = useState(criteria);
  useEffect(() => {
    const timer = setTimeout(() => setSearchCriteria(criteria), 350);
    return () => clearTimeout(timer);
  }, [criteria]);
  useEffect(() => {
    let active = true;
    Promise.all([
      api.get("/technician/me"),
      api.get(
        "/technician/orders?" +
          new URLSearchParams({
            ...searchCriteria,
            page,
            limit: 100,
            view: area === "services" ? filter : "",
          }),
      ),
    ])
      .then(([m, r]) => {
        if (active) {
          setMe(m.data);
          setItems(r.data.items);
          setTotal(r.data.total);
          setError("");
        }
      })
      .catch((e) => {
        if (active) setError(errorMessage(e));
      });
    return () => {
      active = false;
    };
  }, [revision, searchCriteria, page, filter, area]);
  useEffect(() => {
    if (selected) return;
    const timer = setInterval(() => {
      if (!document.hidden) setRevision((r) => r + 1);
    }, 30000);
    return () => clearInterval(timer);
  }, [selected]);
  const list = (items || []).filter(
    (o) =>
      (filter === "closed") === ["CONCLUÍDO", "CANCELADO"].includes(o.status),
  );
  async function logout() {
    try {
      await api.post("/auth/logout", {});
    } catch (e) {
      notify(errorMessage(e), "error");
      return;
    }
    saveToken(null);
    window.dispatchEvent(
      new CustomEvent("invent:unauthorized", { detail: { reason: "logout" } }),
    );
  }
  return (
    <div className="inventory-app portal-app">
      <header className="portal-header">
        <div className="brand">
          <span className="brand-mark">
            <Activity size={23} />
          </span>
          <div>
            <strong>
              Zen<span>Field</span>
            </strong>
            <small>Seus serviços em campo</small>
          </div>
        </div>
        <div className="portal-header-user">
          <span>{me?.name || user.nome}</span>
          <NoticeBell
            onOpen={(n) => {
              if (n.detail.order_id) {
                setArea("services");
                setSelected(n.detail.order_id);
              } else {
                setSelected(null);
                setArea(
                  ["stock", "rates", "finance"].includes(n.target)
                    ? n.target
                    : "services",
                );
              }
            }}
          />
          <button
            className="icon-button"
            aria-label={supervision ? "Alterar minha senha" : "Alterar senha"}
            onClick={() => setPassword(true)}
          >
            <KeyRound size={18} />
          </button>
          <button className="icon-button" aria-label="Sair" onClick={logout}>
            <LogOut size={19} />
          </button>
        </div>
      </header>
      {supervision && (
        <section
          className="portal-supervision"
          aria-label="Ambiente selecionado"
        >
          <div>
            <small>ZENFIELD · ACESSO DA CENTRAL</small>
            <strong>Ambiente de {supervision.name}</strong>
            <p>
              Ações realizadas por {user.nome || user.login}. Sua identidade
              permanece registrada na auditoria.
            </p>
          </div>
          <div className="portal-supervision-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={onChangeTechnician}
            >
              Trocar técnico
            </button>
            {trackingUrl && (
              <a className="secondary-button" href={trackingUrl}>
                Aplicativos
              </a>
            )}
          </div>
        </section>
      )}
      <main className="portal-main">
        <nav className="eco-nav" aria-label="Áreas do portal">
          {[
            ["home", "Início", Activity],
            ["services", "Meus serviços", ClipboardList],
            ["stock", "Meu estoque", Package],
            ["finance", "Meu financeiro", Wallet],
            ["rates", "Meus valores", CircleDollarSign],
          ].map(([key, label, Icon]) => (
            <button
              key={key}
              className={area === key ? "is-active" : ""}
              onClick={() => {
                setArea(key);
                setSelected(null);
              }}
            >
              <Icon size={18} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        {selected ? (
          <Service
            key={selected}
            id={selected}
            onBack={() => setSelected(null)}
            onChanged={() => setRevision((r) => r + 1)}
          />
        ) : area === "home" ? (
          <Home
            items={items || []}
            onOpen={(id) => {
              setArea("services");
              setSelected(id);
            }}
            onNavigate={setArea}
          />
        ) : area === "stock" ? (
          <Stock />
        ) : area === "finance" ? (
          <FinancePanel technical />
        ) : area === "rates" ? (
          <Rates />
        ) : (
          <>
            <div className="portal-intro">
              <div>
                <p className="portal-eyebrow">CAMPO · ATENDIMENTOS</p>
                <h1>Meus serviços</h1>
                <p>Registre o atendimento. A central confirma a conclusão.</p>
              </div>
              <button
                className="secondary-button"
                onClick={() => setRevision((r) => r + 1)}
              >
                <RefreshCw size={16} />
                Atualizar
              </button>
            </div>
            <div className="portal-tabs">
              <button
                className={filter === "open" ? "is-active" : ""}
                onClick={() => {
                  setFilter("open");
                  setPage(1);
                }}
              >
                <ClipboardList size={17} />
                Em atendimento
              </button>
              <button
                className={filter === "closed" ? "is-active" : ""}
                onClick={() => {
                  setFilter("closed");
                  setPage(1);
                }}
              >
                <CheckCheck size={17} />
                Finalizados
              </button>
            </div>
            <div className="eco-filters">
              {[
                ["q", "Número da OS"],
                ["vehicle", "Veículo"],
                ["service", "Tipo de serviço"],
                ["status", "Situação"],
                ["from", "De"],
                ["to", "Até"],
              ].map(([key, label]) => (
                <label className="eco-field" key={key}>
                  {label}
                  <input
                    type={["from", "to"].includes(key) ? "date" : "search"}
                    value={criteria[key]}
                    onChange={(e) => {
                      setCriteria({ ...criteria, [key]: e.target.value });
                      setPage(1);
                    }}
                  />
                </label>
              ))}
            </div>
            <div className="eco-row">
              <button
                className="secondary-button"
                disabled={page === 1}
                onClick={() => setPage((x) => x - 1)}
              >
                Anterior
              </button>
              <span>
                {total} serviços · página {page}
              </span>
              <button
                className="secondary-button"
                disabled={page * 100 >= total}
                onClick={() => setPage((x) => x + 1)}
              >
                Próxima
              </button>
            </div>
            {error && (
              <div className="error-banner" role="alert">
                {error}
              </div>
            )}
            {!items ? (
              <Loading error={error} />
            ) : !list.length ? (
              <Empty
                title="Nenhum serviço nesta lista"
                description="Os atendimentos atribuídos a você aparecerão aqui."
              />
            ) : (
              <div className="portal-orders">
                {list.map((o) => (
                  <button
                    key={o.id}
                    className="dashboard-panel portal-order"
                    onClick={() => setSelected(o.id)}
                  >
                    <div className="portal-order-top">
                      <span>{o.id}</span>
                      <Badge value={o.status} />
                    </div>
                    <h2>{o.vehicle}</h2>
                    <strong>{o.service}</strong>
                    <p>{o.customer_name || "Associado"}</p>
                    <div className="portal-order-bottom">
                      <span>
                        <MapPin size={14} />
                        {o.location || "Local a confirmar"}
                      </span>
                      <span>{format(o.scheduled_at, true)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </main>
      <AppFooter product="ZenField" />
      {password && (
        <FormModal
          title={supervision ? "Alterar minha senha" : "Alterar senha"}
          description={
            (supervision
              ? `Senha da sua conta ZenTracking (${user.login}). `
              : "") + passwordRequirements
          }
          fields={[
            {
              name: "current_password",
              autoComplete: "current-password",
              label: "Senha atual",
              type: "password",
              required: true,
              full: true,
            },
            {
              name: "new_password",
              ...passwordInputProps,
              label: "Nova senha",
              type: "password",
              required: true,
              full: true,
            },
          ]}
          onClose={() => setPassword(false)}
          onSave={async (values) => {
            await api.post("/auth/password", values);
            logout();
          }}
        />
      )}
    </div>
  );
}
