// lib/outlets.ts

export interface OutletConfig {
  domain: string;
  name: string;
  group: string;
  searchUrl: string | null; // {q} replaced with encoded query. null = Google fallback
  lang?: string;
}

export const OUTLETS: OutletConfig[] = [
  // EU-focused
  { domain: "politico.eu", name: "POLITICO Europe", group: "eu-core", searchUrl: "https://www.politico.eu/search/{q}/" },
  { domain: "euractiv.com", name: "Euractiv", group: "eu-core", searchUrl: "https://www.euractiv.com/?s={q}" },
  { domain: "theparliamentmagazine.eu", name: "The Parliament Magazine", group: "eu-niche", searchUrl: "https://www.theparliamentmagazine.eu/search?search={q}" },
  { domain: "euobserver.com", name: "EUobserver", group: "eu-core", searchUrl: "https://euobserver.com/search?query={q}" },
  { domain: "euronews.com", name: "Euronews", group: "eu-core", searchUrl: "https://www.euronews.com/search?query={q}" },
  { domain: "borderlex.eu", name: "Borderlex", group: "eu-niche", searchUrl: null },
  { domain: "mlex.com", name: "MLex", group: "eu-niche", searchUrl: null },
  { domain: "agenceurope.eu", name: "Agence Europe", group: "eu-niche", searchUrl: null },
  { domain: "neweurope.eu", name: "New Europe", group: "eu-niche", searchUrl: "https://www.neweurope.eu/?s={q}" },
  { domain: "theeuropeancorrespondent.com", name: "The European Correspondent", group: "eu-niche", searchUrl: null },
  { domain: "ftm.eu", name: "Follow The Money", group: "eu-niche", searchUrl: "https://www.ftm.eu/search?q={q}" },
  // International
  { domain: "ft.com", name: "Financial Times", group: "intl", searchUrl: "https://www.ft.com/search?q={q}&sort=date" },
  { domain: "economist.com", name: "The Economist", group: "intl", searchUrl: "https://www.economist.com/search?q={q}&sort=date" },
  { domain: "reuters.com", name: "Reuters", group: "intl", searchUrl: "https://www.reuters.com/site-search/?query={q}&sort=newest" },
  { domain: "afp.com", name: "AFP", group: "intl", searchUrl: null },
  { domain: "bloomberg.com", name: "Bloomberg", group: "intl", searchUrl: "https://www.bloomberg.com/search?query={q}" },
  { domain: "apnews.com", name: "Associated Press", group: "intl", searchUrl: "https://apnews.com/search?q={q}" },
  // Wire services
  { domain: "efe.com", name: "EFE", group: "wires", lang: "es", searchUrl: null },
  { domain: "ansa.it", name: "ANSA", group: "wires", lang: "it", searchUrl: null },
  { domain: "dpa.com", name: "DPA", group: "wires", lang: "de", searchUrl: null },
  { domain: "belga.be", name: "Belga", group: "wires", searchUrl: null },
  { domain: "pap.pl", name: "PAP", group: "wires", lang: "pl", searchUrl: null },
  { domain: "lusa.pt", name: "Lusa", group: "wires", lang: "pt", searchUrl: null },
  { domain: "nytimes.com", name: "New York Times", group: "intl", searchUrl: "https://www.nytimes.com/search?query={q}&sort=newest" },
  { domain: "washingtonpost.com", name: "Washington Post", group: "intl", searchUrl: "https://www.washingtonpost.com/search/?query={q}&sort=date" },
  { domain: "wsj.com", name: "Wall Street Journal", group: "intl", searchUrl: "https://www.wsj.com/search?query={q}&sort=date-desc" },
  // German
  { domain: "handelsblatt.com", name: "Handelsblatt", group: "de", lang: "de", searchUrl: "https://www.handelsblatt.com/suche/?begriffe={q}" },
  { domain: "spiegel.de", name: "Der Spiegel", group: "de", lang: "de", searchUrl: "https://www.spiegel.de/suche/?suchbegriff={q}" },
  { domain: "faz.net", name: "FAZ", group: "de", lang: "de", searchUrl: "https://www.faz.net/suche/?query={q}" },
  { domain: "sueddeutsche.de", name: "Süddeutsche Zeitung", group: "de", lang: "de", searchUrl: "https://www.sueddeutsche.de/suche/?search={q}" },
  { domain: "zeit.de", name: "Die Zeit", group: "de", lang: "de", searchUrl: "https://www.zeit.de/suche/index?q={q}" },
  // French
  { domain: "lemonde.fr", name: "Le Monde", group: "fr", lang: "fr", searchUrl: "https://www.lemonde.fr/recherche/?search_keywords={q}&search_sort=date_desc" },
  { domain: "lesechos.fr", name: "Les Echos", group: "fr", lang: "fr", searchUrl: "https://www.lesechos.fr/recherche?query={q}" },
  { domain: "liberation.fr", name: "Libération", group: "fr", lang: "fr", searchUrl: "https://www.liberation.fr/recherche/?query={q}" },
  { domain: "lefigaro.fr", name: "Le Figaro", group: "fr", lang: "fr", searchUrl: "https://recherche.lefigaro.fr/recherche/{q}/" },
  // Spanish
  { domain: "elpais.com", name: "El País", group: "es", lang: "es", searchUrl: "https://elpais.com/buscador/?qt={q}" },
  { domain: "elmundo.es", name: "El Mundo", group: "es", lang: "es", searchUrl: null },
  // Italian
  { domain: "repubblica.it", name: "La Repubblica", group: "it", lang: "it", searchUrl: "https://ricerca.repubblica.it/ricerca/repubblica?query={q}&sortby=ddate" },
  { domain: "corriere.it", name: "Corriere della Sera", group: "it", lang: "it", searchUrl: null },
  { domain: "ilsole24ore.com", name: "Il Sole 24 Ore", group: "it", lang: "it", searchUrl: null },
  // UK
  { domain: "theguardian.com", name: "The Guardian", group: "uk", searchUrl: "https://www.theguardian.com/search?q={q}&order-by=newest" },
  { domain: "thetimes.co.uk", name: "The Times", group: "uk", searchUrl: null },
  { domain: "telegraph.co.uk", name: "The Telegraph", group: "uk", searchUrl: null },
  { domain: "bbc.com", name: "BBC", group: "uk", searchUrl: "https://www.bbc.co.uk/search?q={q}" },
  // Dutch/Belgian
  { domain: "nrc.nl", name: "NRC Handelsblad", group: "benelux", lang: "nl", searchUrl: "https://www.nrc.nl/search/?q={q}" },
  { domain: "volkskrant.nl", name: "De Volkskrant", group: "benelux", lang: "nl", searchUrl: null },
  { domain: "standaard.be", name: "De Standaard", group: "benelux", lang: "nl", searchUrl: null },
  { domain: "tijd.be", name: "De Tijd", group: "benelux", lang: "nl", searchUrl: null },
  { domain: "lesoir.be", name: "Le Soir", group: "benelux", lang: "fr", searchUrl: null },
  // Nordic
  { domain: "dn.se", name: "Dagens Nyheter", group: "nordic", lang: "sv", searchUrl: null },
  { domain: "hs.fi", name: "Helsingin Sanomat", group: "nordic", lang: "fi", searchUrl: null },
  // Polish
  { domain: "wyborcza.pl", name: "Gazeta Wyborcza", group: "pl", lang: "pl", searchUrl: null },
  { domain: "rp.pl", name: "Rzeczpospolita", group: "pl", lang: "pl", searchUrl: null },
];

const DOMAIN_MAP = new Map<string, string>();
for (const o of OUTLETS) DOMAIN_MAP.set(o.domain, o.name);

const SKIP_HOSTS = new Set(["euractiv.fr","euractiv.de","euractiv.pl","euractiv.cz","euractiv.sk","euractiv.ro","euractiv.it","euractiv.gr"]);

export function resolveOutlet(url: string): string | null {
  try {
    const h = new URL(url).hostname.replace(/^www\./, "");
    if (SKIP_HOSTS.has(h)) return null;
    if (DOMAIN_MAP.has(h)) return DOMAIN_MAP.get(h)!;
    for (const [domain, name] of DOMAIN_MAP) { if (h.endsWith("." + domain)) return name; }
    return null;
  } catch { return null; }
}
