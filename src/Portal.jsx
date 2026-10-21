import { appearanceUrl } from "./ui/lib/appearance";
import ThemeControl from "./ui/components/ThemeControl";
import ZenMark from "./ui/components/ZenMark";
import {
  passwordInputProps,
  passwordRequirements,
} from "./ui/lib/password-policy";
import { NoticeBell, Home, Stock, FinancePanel, Rates } from "./Ecosystem";
import { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
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
function FileButtons({ disabled, checklist = false, onFiles }) {
  function selected(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length) onFiles(files);
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
        {checklist ? "Anexar PDFs ou fotos" : "Escolher fotos"}
        <input
          aria-label={
            checklist ? "Anexar checklist assinado" : "Escolher fotos"
          }
          type="file"
          accept={checklist ? "application/pdf,image/*" : "image/*"}
          multiple
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
function Service({ id, onBack, onChanged, onOpenRelated }) {
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
    [queues, setQueues] = useState({});
  const uploading = useRef(false);
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
    closed = ["CONCLUÍDO", "CANCELADO"].includes(order.status),
    rescheduling =
      order.status === "REAGENDAR" || order.visit_outcome === "reschedule";
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
  const equipmentPlan = Object.entries(data.required_equipment || {}).map(
    ([type, quantity]) => ({
      type,
      quantity,
      received: new Set(
        files
          .filter((f) => f.kind === "label" && f.equipment_type === type)
          .map((f) => f.serial_code),
      ).size,
    }),
  );
  const missing = rule.required_photos
    .filter(
      (r) =>
        r.kind === "checklist" &&
        files.filter((f) => f.kind === r.kind).length < r.min,
    )
    .map((r) => r.label);
  if (
    needsChecklist &&
    !files.some((f) => f.kind === "checklist") &&
    !missing.includes("Checklist assinado")
  )
    missing.push("Checklist assinado");
  if (install) {
    for (const item of equipmentPlan) {
      if (item.received < item.quantity)
        missing.push(
          `Foto de ${item.quantity} ${item.type === "TAG" ? "TAG(s)" : "rastreador(es)"} previsto(s) nesta OS`,
        );
      if (item.received > item.quantity)
        missing.push(
          order.bundled_equipment
            ? "Equipamento além da quantidade prevista: peça à central para atualizar a OS."
            : "Equipamento além do previsto: abra uma OS de equipamento adicional com a central.",
        );
    }
  }
  if (needsChecklist && !signed)
    missing.push("Confirmar assinatura do checklist");
  if (!notes.trim()) missing.push("Preencher as observações do técnico");
  async function addFiles(selected, kind, retryId = null) {
    if (uploading.current || !selected.length) return;
    if (files.length + selected.length > 30) {
      setError(
        `Limite de 30 arquivos por atendimento. Você ainda pode adicionar ${30 - files.length}.`,
      );
      return;
    }
    uploading.current = true;
    const queue = selected.map((file) => ({
      id: retryId || crypto.randomUUID(),
      file,
      status: "waiting",
      message: "Na fila",
    }));
    const update = (id, patch) =>
      setQueues((all) => ({
        ...all,
        [kind]: all[kind].map((row) =>
          row.id === id ? { ...row, ...patch } : row,
        ),
      }));
    const remainingFailures = retryId
      ? (queues[kind] || []).filter(
          (row) => row.id !== retryId && row.status === "error",
        ).length
      : 0;
    setQueues((all) => ({
      ...all,
      [kind]: retryId
        ? all[kind].map((row) => (row.id === retryId ? queue[0] : row))
        : queue,
    }));
    try {
      await act(async () => {
        let version = batch.version,
          received = 0;
        const failures = [];
        for (let i = 0; i < queue.length; i++) {
          const row = queue[i];
          const message = `${i + 1} de ${queue.length}: ${row.file.name}`;
          setUploadStatus(
            (kind === "label"
              ? "Identificando equipamento · "
              : "Enviando arquivo · ") + message,
          );
          update(row.id, {
            status: "uploading",
            message:
              kind === "label"
                ? "Lendo código de barras ou QR Code…"
                : "Enviando…",
          });
          if (kind === "label")
            setEquipmentFeedback({ status: "reading", message });
          try {
            const image = await uploadData(row.file, kind === "checklist");
            const { data: result } = await api.post(
              "/technician/batches/" + batch.id + "/photos",
              { version, ...(kind === "other" ? {} : { kind }), image },
              { timeout: 120000 },
            );
            version = result.version;
            received++;
            setConfirmed(false);
            update(row.id, {
              status: "success",
              message: result.serial_code
                ? (result.equipment_type === "TAG"
                    ? "TAG identificada: "
                    : "Rastreador identificado · IMEI/serial: ") +
                  result.serial_code
                : "Arquivo recebido",
            });
          } catch (e) {
            const reason = e.response
              ? errorMessage(e)
              : e.message || errorMessage(e);
            failures.push(reason);
            update(row.id, { status: "error", message: reason });
            // A validation error did not save the file, so the next image keeps
            // the same version. Any uncertain result stops the queue for review.
            if (e.isAxiosError && e.response?.status !== 400) {
              for (const pending of queue.slice(i + 1))
                update(pending.id, {
                  status: "error",
                  message:
                    "Não enviado. Confira os arquivos recebidos e tente novamente.",
                });
              if (kind === "label")
                setEquipmentFeedback({ status: "error", message: reason });
              throw e;
            }
          }
        }
        if (kind === "label")
          setEquipmentFeedback({
            status: failures.length || remainingFailures ? "error" : "success",
            message: failures.length
              ? `${received} equipamento(s) identificado(s); ${failures.length} foto(s) não aceita(s). ${failures[0]}`
              : remainingFailures
                ? `${received} equipamento(s) identificado(s). Há ${remainingFailures} outra(s) foto(s) pendente(s) na lista.`
                : `${received} equipamento(s) identificado(s). Confira os IMEIs/seriais abaixo.`,
          });
        else if (failures.length)
          setError(
            `${failures.length} arquivo(s) não enviado(s). Confira os avisos na lista de arquivos.`,
          );
        if (received) notify(`${received} arquivo(s) recebido(s).`);
      });
    } finally {
      uploading.current = false;
    }
  }
  function uploadQueue(kind) {
    const queue = queues[kind];
    if (!queue?.length) return null;
    return (
      <div
        className="portal-upload-queue"
        aria-label="Arquivos selecionados"
        aria-live="polite"
      >
        <ul>
          {queue.map((row) => (
            <li key={row.id} className={"upload-" + row.status}>
              <div>
                <strong>{row.file.name}</strong>
                <span>{row.message}</span>
              </div>
              {row.status === "error" && (
                <button
                  type="button"
                  className="secondary-button"
                  disabled={busy || stale || rescheduling}
                  onClick={() => addFiles([row.file], kind, row.id)}
                >
                  Tentar novamente
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    );
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
                disabled={busy || stale || rescheduling}
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
            {order.service_label || order.service} ·{" "}
            {order.customer_name || "Associado"}
          </p>
        </div>
        <Badge value={order.status} />
        {order.parent_order_id && (
          <div className="zc-notice">
            <strong>
              OS de equipamento adicional · {order.additional_equipment}
            </strong>
            <p>
              OS principal: {order.parent_order_id}. Este serviço tem
              conferência e remuneração próprias.
            </p>
          </div>
        )}
        {!!data.additional_orders?.length && !order.bundled_equipment && (
          <div className="zc-notice">
            <strong>Equipamentos adicionais deste atendimento</strong>
            <p>
              Registre cada instalação abaixo para contabilizar os serviços
              realizados.
            </p>
            {data.additional_orders.map((extra) => (
              <button
                className="secondary-button"
                type="button"
                disabled={busy}
                key={extra.id}
                onClick={() => onOpenRelated(extra.id)}
              >
                Registrar equipamento adicional · {extra.additional_equipment} ·{" "}
                {extra.status}
              </button>
            ))}
          </div>
        )}

        {order.bundled_equipment && data.additional_orders?.length > 0 && (
          <div className="zc-notice">
            <b>Atendimento com equipamentos adicionais</b>
            <p>
              Envie todas as etiquetas e fotos neste registro. Os{" "}
              {data.additional_orders.length} serviços adicionais serão
              contabilizados junto com a instalação principal.
            </p>
          </div>
        )}
        {order.reuse_equipment && (
          <div className="zc-notice">
            <b>Reinstalação com reaproveitamento</b>
            <p>
              Fotografe os equipamentos existentes. A confirmação da central
              registra o reaproveitamento sem retirar novos aparelhos da sua
              carga.
            </p>
          </div>
        )}
        {rescheduling && (
          <div className="zc-notice">
            <b>Reagendamento solicitado</b>
            <p>Aguarde a central confirmar a nova data do atendimento.</p>
          </div>
        )}
        {order.vehicle_electric && (
          <div className="zc-notice">
            <b>Veículo elétrico</b>
            <p>
              Confirme a autorização do cliente antes de instalar o rastreador.
              Registre qualquer impedimento nas observações e informe a central.
            </p>
          </div>
        )}
        {order.tracker_waiver_authorized && (
          <div className="zc-notice">
            <b>Dispensa de rastreador autorizada</b>
            <p>
              Cliente autorizado a permanecer sem rastreador. Esta OS não
              integra sua remuneração, incluindo adicionais e ajustes. Anexe o
              checklist assinado para conferência da central. As fotos gerais
              são opcionais.
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
          <details className="portal-full-order">
            <summary>Ordem de serviço completa</summary>
            <img
              className="zen-order-logo"
              src="/brand/zen-seguros.png"
              alt="ZEN SEGUROS"
              width="2055"
              height="694"
            />
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
      {error && (
        <div className="error-banner" role="alert">
          {error}
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
      {!batch && !closed && !rescheduling && (
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
              ["Fotos (opcional)", "service-photos", generalFiles.length > 0],
              ...(install
                ? [
                    [
                      "Equipamentos",
                      "service-equipment",
                      equipmentPlan.every(
                        (item) => item.received === item.quantity,
                      ),
                    ],
                  ]
                : []),
              [
                "Checklist",
                "service-checklist",
                signed && files.some((f) => f.kind === "checklist"),
              ],
              ["Enviar", "service-submit", false],
            ].map(([step, target, complete], i) => (
              <button
                key={step}
                type="button"
                className={complete ? "is-complete" : ""}
                onClick={() => {
                  const section = document.getElementById(target);
                  section?.scrollIntoView({
                    behavior: window.matchMedia(
                      "(prefers-reduced-motion: reduce)",
                    ).matches
                      ? "auto"
                      : "smooth",
                    block: "start",
                  });
                  section?.focus({ preventScroll: true });
                }}
                aria-label={`${step}${complete ? " · Recebido" : ""}`}
              >
                <b>{complete ? <CheckCheck size={14} /> : i + 1}</b>
                {step}
              </button>
            ))}
          </div>
          <section
            className="dashboard-panel portal-step"
            id="service-photos"
            tabIndex={-1}
          >
            <div className="portal-step-title">
              <span>1</span>
              <div>
                <h2>Fotos do atendimento (opcionais)</h2>
                <p>
                  Use os botões abaixo. Confira se as fotos ficaram nítidas.
                </p>
              </div>
            </div>
            <div className="portal-capture-group">
              <h3>Fotos do atendimento</h3>
              <p>
                {generalFiles.length} recebida(s) · Opcional, sem quantidade
                mínima. Adicione fotos do veículo, serviço ou vistoria quando
                forem úteis para registrar o atendimento.
              </p>
              <FileButtons
                disabled={busy || stale || rescheduling}
                onFiles={(files) => addFiles(files, "other")}
              />
              {uploadQueue("other")}
              {photos("other")}
            </div>
          </section>
          {install && (
            <section
              className="dashboard-panel portal-step"
              id="service-equipment"
              tabIndex={-1}
            >
              <div className="portal-step-title">
                <span>2</span>
                <div>
                  <h2>Equipamentos previstos nesta OS</h2>
                  <p>
                    Envie uma foto nítida da etiqueta de cada equipamento. A
                    leitura do código de barras ou QR Code identifica o IMEI ou
                    serial e confere sua carga automaticamente. Você será
                    avisado se a leitura falhar.
                  </p>
                </div>
              </div>
              <div
                className="portal-equipment-plan"
                aria-label="Fotos dos equipamentos previstos"
              >
                {equipmentPlan
                  .filter((item) => item.quantity > 0)
                  .map((item) => (
                    <div
                      className={
                        "portal-equipment-requirement " +
                        (item.received === item.quantity ? "is-complete" : "")
                      }
                      key={item.type}
                    >
                      <strong>
                        {item.quantity}{" "}
                        {item.type === "TAG" ? "TAG" : "rastreador"}
                        {item.quantity > 1 ? "(s)" : ""}
                      </strong>
                      <p>
                        {item.received} de {item.quantity} identificado(s)
                      </p>
                      <span>
                        {item.received < item.quantity
                          ? `Envie a foto da etiqueta ${item.type === "TAG" ? "da TAG" : "do rastreador"}.`
                          : "Foto e código recebidos."}
                      </span>
                    </div>
                  ))}
              </div>
              <p className="zc-muted">
                Equipamentos extras têm uma OS de equipamento adicional, com
                atendimento e remuneração próprios. Envie cada etiqueta na OS
                correspondente.
              </p>
              <FileButtons
                disabled={busy || stale || rescheduling}
                onFiles={(files) => addFiles(files, "label")}
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
              {uploadQueue("label")}
              {photos("label")}
              {!codes.length && (
                <p className="zc-muted">
                  Nenhum equipamento identificado ainda.
                </p>
              )}
            </section>
          )}
          <section
            className="dashboard-panel portal-step"
            id="service-checklist"
            tabIndex={-1}
          >
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
              disabled={busy || stale || rescheduling}
              onFiles={(files) => addFiles(files, "checklist")}
            />
            {uploadQueue("checklist")}
            {photos("checklist")}
            <label className="zc-checkbox">
              <input
                type="checkbox"
                checked={signed}
                disabled={busy || stale || rescheduling}
                onChange={(e) => {
                  setSigned(e.target.checked);
                  setConfirmed(false);
                }}
              />
              O checklist anexado está preenchido e assinado.
            </label>
          </section>
          <section
            className="dashboard-panel portal-step"
            id="service-submit"
            tabIndex={-1}
          >
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
                disabled={busy || stale || rescheduling}
              />
            </label>
            <label className="zc-field zc-full">
              Observações do técnico (obrigatórias)
              <textarea
                aria-label="Observações do técnico (obrigatórias)"
                required
                rows={3}
                maxLength={6000}
                value={notes}
                disabled={busy || stale || rescheduling}
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
                      notes,
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
                disabled={busy || stale || rescheduling}
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
  const list = items || [];
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
      <a className="skip-link" href="#field-content">
        Ir para o conteúdo
      </a>
      <header className="portal-header">
        <div className="brand">
          <span className="brand-mark">
            <ZenMark variant="field" size={36} />
          </span>
          <div>
            <strong>
              Zen<span>Field</span>
            </strong>
            <small>Seus serviços em campo</small>
          </div>
        </div>
        <div className="portal-header-user">
          <ThemeControl />
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
              <a
                className="secondary-button"
                href={trackingUrl}
                onClick={(e) => {
                  e.preventDefault();
                  window.location.assign(appearanceUrl(trackingUrl));
                }}
              >
                Aplicativos
              </a>
            )}
          </div>
        </section>
      )}
      <main className="portal-main" id="field-content" tabIndex={-1}>
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
              aria-current={area === key ? "page" : undefined}
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
            onOpenRelated={setSelected}
          />
        ) : area === "home" ? (
          <Home
            items={(items || []).map((o) => ({
              ...o,
              status: o.group_status || o.status,
            }))}
            loading={!items}
            name={me?.name || user.nome}
            onOpen={(id) => {
              setArea("services");
              setSelected(id);
            }}
            onNavigate={(next, view, status) => {
              setArea(next);
              if (next === "services") {
                setFilter(view || "open");
                setCriteria({
                  q: "",
                  vehicle: "",
                  service: "",
                  status: status || "",
                  from: "",
                  to: "",
                });
                setPage(1);
              }
            }}
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
            <details className="portal-search-filters">
              <summary>
                Filtrar serviços{" "}
                {Object.values(criteria).some(Boolean) && (
                  <b>
                    · {Object.values(criteria).filter(Boolean).length} ativo(s)
                  </b>
                )}{" "}
                <span>OS, veículo, situação ou período</span>
              </summary>
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
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  setCriteria({
                    q: "",
                    vehicle: "",
                    service: "",
                    status: "",
                    from: "",
                    to: "",
                  });
                  setPage(1);
                }}
              >
                Limpar filtros
              </button>
            </details>
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
                      <Badge value={o.group_status || o.status} />
                    </div>
                    <h2>{o.vehicle}</h2>
                    <strong>{o.service_label || o.service}</strong>
                    <p>{o.customer_name || "Associado"}</p>
                    {o.vehicle_electric && <p>Veículo elétrico</p>}
                    {o.additional_orders?.map((extra) => (
                      <p key={extra.id}>
                        + {extra.additional_equipment} · {extra.status}
                      </p>
                    ))}
                    {!!o.group_imeis?.length && (
                      <p>IMEI/serial: {o.group_imeis.join(" · ")}</p>
                    )}
                    <div className="portal-order-bottom">
                      <span>
                        <MapPin size={14} />
                        {o.location || "Local a confirmar"}
                      </span>
                      <span>{format(o.scheduled_at, true)}</span>
                    </div>
                    <span className="portal-order-action">
                      Abrir atendimento <ArrowRight size={16} />
                    </span>
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
