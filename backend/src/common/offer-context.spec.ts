import { toOfferContext } from './offer-context';

describe('toOfferContext', () => {
  const offer = {
    id: 'offer-1',
    title: 'Backend Developer',
    company: 'Acme',
    url: 'https://jobs.example.com/1',
  };

  it('usa la oferta guardada cuando existe', () => {
    expect(toOfferContext({ jobOfferId: 'offer-1', offer })).toEqual({
      id: 'offer-1',
      title: 'Backend Developer',
      company: 'Acme',
      url: 'https://jobs.example.com/1',
      saved: true,
    });
  });

  it('usa el snapshot cuando la oferta fue eliminada', () => {
    expect(
      toOfferContext({
        jobOfferId: null,
        offer: null,
        snapshot: { title: 'Data Analyst', company: 'Globex' },
      }),
    ).toEqual({
      id: null,
      title: 'Data Analyst',
      company: 'Globex',
      url: null,
      saved: false,
    });
  });

  it('marca como no guardado un match calculado sin guardar la oferta', () => {
    const context = toOfferContext({
      jobOfferId: null,
      offer: null,
      snapshot: { title: 'Data Analyst', company: null },
    });

    expect(context.saved).toBe(false);
    expect(context.title).toBe('Data Analyst');
    expect(context.company).toBeNull();
  });

  it('conserva el id cuando la oferta relacionada no vino incluida', () => {
    const context = toOfferContext({
      jobOfferId: 'offer-2',
      offer: null,
      snapshot: { title: 'Platform Engineer' },
    });

    expect(context.id).toBe('offer-2');
    expect(context.saved).toBe(true);
  });

  it('devuelve título vacío si el snapshot no lo trae', () => {
    expect(toOfferContext({ jobOfferId: null, snapshot: null }).title).toBe('');
  });
});
