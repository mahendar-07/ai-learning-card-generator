import { CardIdle } from "./CardIdle.jsx";
import { CardSkeleton } from "./CardSkeleton.jsx";
import { Card } from "./Card.jsx";
import { ErrorCard } from "./ErrorCard.jsx";

export function CardSlot({ card, onRetry, isRetrying }) {
  switch (card.status) {
    case "loading":
      return <CardSkeleton index={card.index} />;
    case "ready":
      return <Card index={card.index} data={card.data} />;
    case "error":
      return (
        <ErrorCard
          index={card.index}
          message={card.error}
          onRetry={onRetry}
          isRetrying={isRetrying}
        />
      );
    default:
      return <CardIdle index={card.index} />;
  }
}
