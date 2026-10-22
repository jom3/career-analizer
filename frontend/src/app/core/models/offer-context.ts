// Oferta asociada a un resultado generado (match, CV adaptado o carta).
// `saved` es false cuando el match se calculó sin guardar la oferta.
export interface OfferContext {
  id: string | null;
  title: string;
  company: string | null;
  url: string | null;
  saved: boolean;
}
