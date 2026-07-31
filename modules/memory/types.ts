export type SessionPreference = {
  value: string;
  polarity: "like" | "dislike" | "prefer";
};

export type SessionMemorySnapshot = {
  userName?: string;
  userAge?: number;
  userLocation?: string;
  preferences: SessionPreference[];
  activeSubjectIds: string[];
  previousQuestion?: string;
  previousAnswer?: string;
};

export type MemoryResponse = {
  text: string;
  intent: string;
  field: string;
  evidence: string[];
  structureId: string;
};

