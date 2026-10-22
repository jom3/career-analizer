export interface OfferContext {
  id: string | null;
  title: string;
  company: string | null;
  url: string | null;
  saved: boolean;
}

export interface OfferContextOffer {
  id: string;
  title: string;
  company: string | null;
  url: string | null;
}

export interface OfferContextSnapshot {
  title?: string | null;
  company?: string | null;
}

// Campos de la oferta que necesita el contexto en las listas y detalles.
export const OFFER_CONTEXT_SELECT = {
  id: true,
  title: true,
  company: true,
  url: true,
} as const;

// Resuelve la oferta asociada a un resultado generado. Si la oferta ya no
// existe (o el match se calculó sin guardarla), se usa el snapshot para
// conservar título y empresa.
export function toOfferContext(input: {
  jobOfferId: string | null;
  offer?: OfferContextOffer | null;
  snapshot?: OfferContextSnapshot | null;
}): OfferContext {
  const { jobOfferId, offer, snapshot } = input;
  if (offer) {
    return {
      id: offer.id,
      title: offer.title,
      company: offer.company,
      url: offer.url,
      saved: true,
    };
  }
  return {
    id: jobOfferId,
    title: snapshot?.title?.trim() || '',
    company: snapshot?.company?.trim() || null,
    url: null,
    saved: jobOfferId !== null,
  };
}
