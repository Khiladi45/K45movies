// Full ISO 639-1 language list used by the "Preferred Audio Language" setting
// (Movie Based layout) and by the audio-language detection in audioLanguages.ts.

const RAW =
  "aa:Afar,ab:Abkhazian,ae:Avestan,af:Afrikaans,ak:Akan,am:Amharic,an:Aragonese,ar:Arabic,as:Assamese,av:Avaric,ay:Aymara,az:Azerbaijani," +
  "ba:Bashkir,be:Belarusian,bg:Bulgarian,bh:Bihari,bi:Bislama,bm:Bambara,bn:Bengali,bo:Tibetan,br:Breton,bs:Bosnian," +
  "ca:Catalan,ce:Chechen,ch:Chamorro,co:Corsican,cr:Cree,cs:Czech,cu:Church Slavic,cv:Chuvash,cy:Welsh," +
  "da:Danish,de:German,dv:Divehi,dz:Dzongkha,ee:Ewe,el:Greek,en:English,eo:Esperanto,es:Spanish,et:Estonian,eu:Basque," +
  "fa:Persian,ff:Fulah,fi:Finnish,fj:Fijian,fo:Faroese,fr:French,fy:Western Frisian," +
  "ga:Irish,gd:Scottish Gaelic,gl:Galician,gn:Guarani,gu:Gujarati,gv:Manx," +
  "ha:Hausa,he:Hebrew,hi:Hindi,ho:Hiri Motu,hr:Croatian,ht:Haitian Creole,hu:Hungarian,hy:Armenian,hz:Herero," +
  "ia:Interlingua,id:Indonesian,ie:Interlingue,ig:Igbo,ii:Sichuan Yi,ik:Inupiaq,io:Ido,is:Icelandic,it:Italian,iu:Inuktitut," +
  "ja:Japanese,jv:Javanese,ka:Georgian,kg:Kongo,ki:Kikuyu,kj:Kuanyama,kk:Kazakh,kl:Kalaallisut,km:Khmer,kn:Kannada,ko:Korean,kr:Kanuri,ks:Kashmiri,ku:Kurdish,kv:Komi,kw:Cornish,ky:Kyrgyz," +
  "la:Latin,lb:Luxembourgish,lg:Ganda,li:Limburgish,ln:Lingala,lo:Lao,lt:Lithuanian,lu:Luba-Katanga,lv:Latvian," +
  "mg:Malagasy,mh:Marshallese,mi:Maori,mk:Macedonian,ml:Malayalam,mn:Mongolian,mr:Marathi,ms:Malay,mt:Maltese,my:Burmese," +
  "na:Nauru,nb:Norwegian Bokmal,nd:North Ndebele,ne:Nepali,ng:Ndonga,nl:Dutch,nn:Norwegian Nynorsk,no:Norwegian,nr:South Ndebele,nv:Navajo,ny:Chichewa," +
  "oc:Occitan,oj:Ojibwa,om:Oromo,or:Odia,os:Ossetian,pa:Punjabi,pi:Pali,pl:Polish,ps:Pashto,pt:Portuguese,qu:Quechua," +
  "rm:Romansh,rn:Kirundi,ro:Romanian,ru:Russian,rw:Kinyarwanda," +
  "sa:Sanskrit,sc:Sardinian,sd:Sindhi,se:Northern Sami,sg:Sango,si:Sinhala,sk:Slovak,sl:Slovenian,sm:Samoan,sn:Shona,so:Somali,sq:Albanian,sr:Serbian,ss:Swati,st:Southern Sotho,su:Sundanese,sv:Swedish,sw:Swahili," +
  "ta:Tamil,te:Telugu,tg:Tajik,th:Thai,ti:Tigrinya,tk:Turkmen,tl:Tagalog,tn:Tswana,to:Tonga,tr:Turkish,ts:Tsonga,tt:Tatar,tw:Twi,ty:Tahitian," +
  "ug:Uyghur,uk:Ukrainian,ur:Urdu,uz:Uzbek,ve:Venda,vi:Vietnamese,vo:Volapuk,wa:Walloon,wo:Wolof,xh:Xhosa,yi:Yiddish,yo:Yoruba,za:Zhuang,zh:Chinese,zu:Zulu";

export type LanguageOption = { label: string; value: string };

const ALL: LanguageOption[] = RAW.split(",").map((entry) => {
  const [value, label] = entry.split(":");
  return { value, label };
});

export const LANGUAGE_NAME_BY_CODE: Record<string, string> = Object.fromEntries(
  ALL.map((item) => [item.value, item.label]),
);


export const NO_LANGUAGE = "none";

// The audio-language picker only offers the languages this app's audience uses.
export const PICKER_LANGUAGES = ["ta", "te", "ml", "kn", "hi", "en", "ko", "ja"];

export const AUDIO_LANGUAGE_OPTIONS: LanguageOption[] = [
  { value: NO_LANGUAGE, label: "No preference" },
  ...PICKER_LANGUAGES.map((code) => ({
    value: code,
    label: LANGUAGE_NAME_BY_CODE[code],
  })),
];

export const languageName = (code?: string | null): string =>
  (code && LANGUAGE_NAME_BY_CODE[code]) || (code ? code.toUpperCase() : "");

// ---- Normalising whatever a provider or manifest calls a language ----------

// ISO 639-2 and common abbreviations → ISO 639-1.
const ALIASES: Record<string, string> = {
  tam: "ta",
  tel: "te",
  hin: "hi",
  mal: "ml",
  kan: "kn",
  eng: "en",
  ben: "bn",
  bangla: "bn",
  mar: "mr",
  pan: "pa",
  pun: "pa",
  panjabi: "pa",
  guj: "gu",
  urd: "ur",
  ori: "or",
  oriya: "or",
  kor: "ko",
  jpn: "ja",
  jap: "ja",
  zho: "zh",
  chi: "zh",
  mandarin: "zh",
  cantonese: "zh",
  spa: "es",
  castellano: "es",
  fra: "fr",
  fre: "fr",
  deu: "de",
  ger: "de",
  rus: "ru",
  ara: "ar",
  tur: "tr",
  tha: "th",
  por: "pt",
  ita: "it",
  vie: "vi",
  nld: "nl",
  dut: "nl",
  pol: "pl",
  swe: "sv",
  fas: "fa",
  per: "fa",
  farsi: "fa",
  heb: "he",
  ell: "el",
  gre: "el",
  ukr: "uk",
  ind: "id",
  msa: "ms",
  fil: "tl",
  filipino: "tl",
  sin: "si",
  nep: "ne",
  asm: "as",
};

const CODE_BY_NAME: Record<string, string> = {};
ALL.forEach((item) => {
  CODE_BY_NAME[item.label.toLowerCase()] = item.value;
});

/** "ta", "ta-IN", "tam", "Tamil" → "ta". Returns null when unrecognised. */
export function normalizeLangCode(value?: string | null): string | null {
  if (!value) return null;
  const text = String(value).trim().toLowerCase();
  if (!text) return null;
  if (CODE_BY_NAME[text]) return CODE_BY_NAME[text];
  if (ALIASES[text]) return ALIASES[text];
  const base = text.split(/[-_]/)[0];
  if (LANGUAGE_NAME_BY_CODE[base]) return base;
  if (ALIASES[base]) return ALIASES[base];
  if (CODE_BY_NAME[base]) return CODE_BY_NAME[base];
  return null;
}

// Languages worth looking for inside free text (titles, server names). The
// full ISO list would produce false positives such as "Latin" or "Tonga".
const TEXT_CODES = [
  "ta", "te", "hi", "ml", "kn", "en", "bn", "mr", "pa", "gu", "ur", "or",
  "as", "ne", "si", "ko", "ja", "zh", "es", "fr", "de", "it", "pt", "ru",
  "ar", "tr", "th", "id", "vi", "pl", "nl", "sv", "fa", "he", "el", "uk",
  "ms", "tl",
];

export const TEXT_LANGUAGE_NAMES: Record<string, string> = {};
TEXT_CODES.forEach((code) => {
  TEXT_LANGUAGE_NAMES[LANGUAGE_NAME_BY_CODE[code].toLowerCase()] = code;
});
// Spellings that show up in release names.
["mandarin", "cantonese", "bangla", "panjabi", "oriya", "farsi", "filipino"].forEach(
  (name) => {
    TEXT_LANGUAGE_NAMES[name] = ALIASES[name];
  },
);

export const TEXT_LANGUAGE_ABBREVIATIONS: Record<string, string> = {
  hin: "hi",
  tam: "ta",
  tel: "te",
  mal: "ml",
  kan: "kn",
  eng: "en",
  ben: "bn",
  mar: "mr",
  pun: "pa",
  guj: "gu",
  urd: "ur",
  kor: "ko",
  jap: "ja",
  chi: "zh",
  spa: "es",
  fre: "fr",
  ger: "de",
  rus: "ru",
  ara: "ar",
  tur: "tr",
  tha: "th",
};
