import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Search,
  Smartphone,
  UserRound,
} from "lucide-react";
import { useSession } from "./ui/lib/session";
import { api, errorMessage, setTechnicianContext } from "./ui/lib/api";
import { Loading } from "./ui/components/service-common";
import { notify } from "./ui/lib/feedback";
import AppFooter from "./ui/components/AppFooter";
import TechnicianPortal from "./Portal";
export default function FieldEntry() {
  const user = useSession(),
    staff = ["admin", "operador"].includes(user.papel);
  const [selected, setSelected] = useState(null),
    [items, setItems] = useState(null),
    [q, setQ] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [trackingUrl, setTrackingUrl] = useState("");
  useEffect(() => {
    if (!staff || selected) return;
    let active = true;
    setLoading(true);
    const timer = setTimeout(
      () => {
        Promise.all([
          api.get("/field/technicians?q=" + encodeURIComponent(q)),
          api.get("/auth/config"),
        ])
          .then(([list, config]) => {
            if (!active) return;
            setItems(list.data.items);
            setTrackingUrl(config.data.login_url || "");
            setError("");
          })
          .catch((e) => {
            if (active) setError(errorMessage(e));
          })
          .finally(() => {
            if (active) setLoading(false);
          });
      },
      q ? 300 : 0,
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [staff, selected, q]);
  async function choose(technician) {
    setBusy(true);
    setError("");
    try {
      setTechnicianContext(technician.id);
      const { data } = await api.post("/technician/context", {});
      setSelected({ id: data.id, name: data.name });
    } catch (e) {
      try {
        setTechnicianContext(null);
      } catch {}
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  function switchTechnician() {
    try {
      setTechnicianContext(null);
      setSelected(null);
    } catch (e) {
      notify(e.message, "error");
    }
  }
  if (!staff) return <TechnicianPortal />;
  if (selected)
    return (
      <TechnicianPortal
        key={selected.id}
        supervision={selected}
        onChangeTechnician={switchTechnician}
        trackingUrl={trackingUrl}
      />
    );
  return (
    <div className="inventory-app portal-app field-selector-app">
      <header className="portal-header">
        <div className="brand">
          <span className="brand-mark">
            <Smartphone size={23} />
          </span>
          <div>
            <strong>
              Zen<span>Field</span>
            </strong>
            <small>ZenTracking · Central</small>
          </div>
        </div>
        <span>{user.nome}</span>
      </header>
      <main className="portal-main field-selector-main">
        {trackingUrl && (
          <a className="secondary-button" href={trackingUrl}>
            <ArrowLeft size={16} />
            Aplicativos
          </a>
        )}
        <div className="field-selector-intro">
          <p className="portal-eyebrow">ACOMPANHAMENTO E OPERAÇÃO</p>
          <h1>Qual técnico você quer acessar?</h1>
          <p>
            Abra os serviços, equipamentos e financeiro do técnico. As ações
            ficam registradas em seu nome.
          </p>
        </div>
        <label className="field-selector-search">
          <Search size={19} />
          <input
            type="search"
            aria-label="Buscar técnico"
            placeholder="Buscar técnico pelo nome"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        {error && (
          <div className="error-banner" role="alert">
            {error}
          </div>
        )}
        {loading ? (
          <Loading />
        ) : !items?.length ? (
          <div className="zc-notice">Nenhum técnico ativo encontrado.</div>
        ) : (
          <div className="field-selector-grid">
            {items.map((t) => (
              <button
                type="button"
                className="dashboard-panel field-technician-card"
                key={t.id}
                disabled={busy}
                onClick={() => choose(t)}
                aria-label={`Acessar ambiente de ${t.name}`}
              >
                <span className="field-technician-avatar">
                  <UserRound size={24} />
                </span>
                <span>
                  <strong>{t.name}</strong>
                  <small>
                    {busy ? "Abrindo…" : "Abrir ambiente do técnico"}
                  </small>
                </span>
                <ArrowRight size={18} />
              </button>
            ))}
          </div>
        )}
      </main>
      <AppFooter product="ZenField" />
    </div>
  );
}
