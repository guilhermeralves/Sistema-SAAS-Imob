export type NewPropertyDraftData = {
  titulo: string;
  descricao: string;
  tipo: string;
  finalidade: string;
  idCorretor: string;
  valor: string;
  area: string;
  quartos: string;
  banheiros: string;
  vagas: string;
  endereco: string;
  numero: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  ownerName: string;
  ownerEmail: string;
  ownerCpf: string;
  ownerPhone: string;
};

const NEW_PROPERTY_DRAFT_STORAGE_KEY = "afg_new_property_draft_v1";
const NEW_PROPERTY_DRAFT_PHOTOS_STORAGE_KEY = "afg_new_property_draft_photos_v1";

function isStringRecord(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== "object") return false;
  return Object.values(value).every(item => typeof item === "string");
}

export function saveNewPropertyDraft(data: NewPropertyDraftData) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(NEW_PROPERTY_DRAFT_STORAGE_KEY, JSON.stringify(data));
}

export function loadNewPropertyDraft() {
  if (typeof window === "undefined") return null;

  const rawValue = window.sessionStorage.getItem(NEW_PROPERTY_DRAFT_STORAGE_KEY);
  if (!rawValue) return null;

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    if (!isStringRecord(parsed)) return null;

    return parsed as NewPropertyDraftData;
  } catch {
    return null;
  }
}

export function clearNewPropertyDraft() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(NEW_PROPERTY_DRAFT_STORAGE_KEY);
  window.sessionStorage.removeItem(NEW_PROPERTY_DRAFT_PHOTOS_STORAGE_KEY);
}

export function saveNewPropertyDraftPhotos(photoUrls: string[]) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(NEW_PROPERTY_DRAFT_PHOTOS_STORAGE_KEY, JSON.stringify(photoUrls));
}

export function loadNewPropertyDraftPhotos() {
  if (typeof window === "undefined") return [];

  const rawValue = window.sessionStorage.getItem(NEW_PROPERTY_DRAFT_PHOTOS_STORAGE_KEY);
  if (!rawValue) return [];

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(item => typeof item === "string");
  } catch {
    return [];
  }
}
