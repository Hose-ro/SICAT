export default function Modal({ open, onClose, title, children, wide = false }) {
  if (!open) return null
  return (
    <div className="modal-overlay">
      <div className={`modal-panel${wide ? ' modal-panel--wide' : ''}`}>
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button onClick={onClose} className="modal-close" type="button" aria-label="Cerrar modal">
            &times;
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}
