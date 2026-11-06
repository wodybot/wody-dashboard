// Module pages for the other languages are written in a compact form:
// [hero title, hero subtitle, meta title, meta description, og title, og description, intro, features, faq, audience, pains]
// with faq as [question, answer] pairs. This turns them into the page shape the module page reads.
export function expandPages(compact) {
  return Object.fromEntries(Object.entries(compact).map(([slug, row]) => {
    const [heroTitle, heroSubtitle, metaTitle, metaDescription, ogTitle, ogDescription, intro, features, faq, audience, pains] = row;
    return [slug, {
      heroTitle, heroSubtitle, metaTitle, metaDescription, ogTitle, ogDescription,
      intro, features, faq: faq.map(([q, a]) => ({ q, a })), audience, pains, faqMore: [],
    }];
  }));
}
