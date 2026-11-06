// Every module page written in full for the languages other than English and Romanian.
import { FR_A } from './fr-a';
import { FR_B } from './fr-b';
import { IT_A } from './it-a';
import { IT_B } from './it-b';
import { DE_A } from './de-a';
import { DE_B } from './de-b';
import { ES_A } from './es-a';
import { ES_B } from './es-b';
import { NL_A } from './nl-a';
import { NL_B } from './nl-b';
import { PT_A } from './pt-a';
import { PT_B } from './pt-b';
import { TR_A } from './tr-a';
import { TR_B } from './tr-b';

export const INTL_MODULE_PAGES = {
  fr: { ...FR_A, ...FR_B },
  it: { ...IT_A, ...IT_B },
  de: { ...DE_A, ...DE_B },
  es: { ...ES_A, ...ES_B },
  nl: { ...NL_A, ...NL_B },
  pt: { ...PT_A, ...PT_B },
  tr: { ...TR_A, ...TR_B },
};
