import { AlertTriangle, PackageOpen, X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
export const Panel = ({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) => (
  <section className={`panel ${className}`}>
    {title && (
      <h2 className="panel-title">
        <span /> {title}
      </h2>
    )}
    {children}
  </section>
);
export const Loading = ({
  label = "Sincronizando dados...",
}: {
  label?: string;
}) => (
  <main className="center-state">
    <div className="scan-core" />
    <b>SISTEMA</b>
    <span>{label}</span>
  </main>
);
export const Empty = ({ text }: { text: string }) => (
  <div className="empty">
    <PackageOpen />
    <span>{text}</span>
  </div>
);
export const ErrorState = ({ text }: { text: string }) => (
  <div className="error-state">
    <AlertTriangle />
    <span>{text}</span>
  </div>
);
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const modalRef = useRef<HTMLElement>(null),
    closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const modal = modalRef.current;
    if (!modal) return;
    const focusable = () =>
      Array.from(
        modal.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((x) => !x.hasAttribute("hidden"));
    (focusable()[0] ?? modal).focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const nodes = focusable();
      if (!nodes.length) {
        event.preventDefault();
        modal.focus();
        return;
      }
      const first = nodes[0],
        last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section
        ref={modalRef}
        tabIndex={-1}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <header>
          <h2 id="modal-title">{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Fechar">
            <X />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
