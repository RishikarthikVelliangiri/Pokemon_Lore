export default function ErrorScreen({ message, onRetry }: Readonly<{ message: string | null; onRetry: () => void }>) {
  return (
    <div className="screen" role="alert">
      <header className="lcd-head"><h1>ERROR</h1></header>
      <p className="dialog-text">A wild error appeared!</p>
      <p className="dialog-text dim">{message || 'An unknown error occurred.'}</p>
      <button className="lcd-btn" onClick={onRetry}>TRY AGAIN</button>
    </div>
  );
}
