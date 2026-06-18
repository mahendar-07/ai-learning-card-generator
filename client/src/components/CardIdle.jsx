export function CardIdle({ index }) {
  return (
    <div className="card card--idle">
      <span className="card__tab">No. 0{index}</span>
      <p className="card__idle-text">Waiting to generate</p>
    </div>
  );
}
