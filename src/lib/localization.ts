import { Atelie } from '../types';

export type PaisTipo = 'AO' | 'PT' | 'BR';

export interface LocalInfo {
  nome: string;
  codigoDDI: string;
  moeda: string;
  exemploTelefone: string;
  placeholderFaturamento: string;
  basicPrice: number;
  proPrice: number;
  locale: string;
  flag: string;
}

export const PAISES_CONFIG: Record<PaisTipo, LocalInfo> = {
  AO: {
    nome: 'Angola',
    codigoDDI: '244',
    moeda: 'Kz',
    exemploTelefone: '923000000',
    placeholderFaturamento: 'Kz',
    basicPrice: 5000,
    proPrice: 9000,
    locale: 'pt-AO',
    flag: '🇦🇴'
  },
  PT: {
    nome: 'Portugal',
    codigoDDI: '351',
    moeda: '€',
    exemploTelefone: '912345678',
    placeholderFaturamento: '€',
    basicPrice: 9,
    proPrice: 15,
    locale: 'pt-PT',
    flag: '🇵🇹'
  },
  BR: {
    nome: 'Brasil',
    codigoDDI: '55',
    moeda: 'R$',
    exemploTelefone: '11987654321',
    placeholderFaturamento: 'R$',
    basicPrice: 29,
    proPrice: 49,
    locale: 'pt-BR',
    flag: '🇧🇷'
  }
};

export function getAtelieCountry(atelie: Atelie | null | undefined): PaisTipo {
  if (!atelie || !atelie.pais) return 'AO';
  return atelie.pais;
}

export function formatarMoeda(valor: number, atelie: Atelie | null | undefined): string {
  const pais = getAtelieCountry(atelie);
  const config = PAISES_CONFIG[pais];
  const valueFormatted = (valor || 0).toLocaleString(config.locale, {
    minimumFractionDigits: (pais === 'PT' || pais === 'BR') ? 2 : 0,
    maximumFractionDigits: (pais === 'PT' || pais === 'BR') ? 2 : 0,
  });
  
  if (pais === 'BR') {
    return `R$ ${valueFormatted}`;
  } else if (pais === 'PT') {
    return `${valueFormatted} €`;
  } else {
    return `${valueFormatted} Kz`;
  }
}

export function formatarMoedaSimples(valor: number, pais: PaisTipo): string {
  const config = PAISES_CONFIG[pais];
  const valueFormatted = (valor || 0).toLocaleString(config.locale, {
    minimumFractionDigits: (pais === 'PT' || pais === 'BR') ? 2 : 0,
    maximumFractionDigits: (pais === 'PT' || pais === 'BR') ? 2 : 0,
  });
  
  if (pais === 'BR') {
    return `R$ ${valueFormatted}`;
  } else if (pais === 'PT') {
    return `${valueFormatted} €`;
  } else {
    return `${valueFormatted} Kz`;
  }
}

export function getPrecoPlano(plano: 'basico' | 'pro', atelie: Atelie | null | undefined): string {
  const pais = getAtelieCountry(atelie);
  const config = PAISES_CONFIG[pais];
  const preco = plano === 'basico' ? config.basicPrice : config.proPrice;
  return formatarMoeda(preco, atelie);
}
