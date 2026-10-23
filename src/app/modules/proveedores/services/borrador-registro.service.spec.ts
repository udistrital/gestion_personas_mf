import {
  BORRADOR_PERSONA_NATURAL_KEY,
  BorradorRegistroService,
} from "./borrador-registro.service";
import { BorradorRegistroPersonaNatural } from "../models/borrador-registro.model";

describe("BorradorRegistroService", () => {
  let service: BorradorRegistroService;
  const store = new Map<string, string>();

  const memoryStorage: Storage = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => [...store.keys()][index] ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  };

  const borrador: BorradorRegistroPersonaNatural = {
    version: 1,
    currentStep: 2,
    savedAt: "2026-10-02T15:00:00.000Z",
    formValue: {
      identificacion: { primerNombre: "Ana" },
      documentos: { rutArchivo: null },
    },
  };

  beforeEach(() => {
    store.clear();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: memoryStorage,
    });
    service = new BorradorRegistroService();
  });

  afterEach(() => {
    store.clear();
  });

  it("persists and restores a draft", () => {
    expect(service.guardar(borrador)).toBe(true);
    expect(service.cargar()).toEqual(borrador);
  });

  it("drops File values before writing JSON", () => {
    const archivo = new File(["contenido"], "rut.pdf", {
      type: "application/pdf",
    });

    service.guardar({
      ...borrador,
      formValue: {
        documentos: { rutArchivo: archivo },
      },
    });

    const stored = JSON.parse(
      localStorage.getItem(BORRADOR_PERSONA_NATURAL_KEY) ?? "{}",
    ) as BorradorRegistroPersonaNatural;

    expect(stored.formValue).toEqual({
      documentos: { rutArchivo: null },
    });
  });

  it("returns null when storage is empty or invalid", () => {
    expect(service.cargar()).toBeNull();
    localStorage.setItem(BORRADOR_PERSONA_NATURAL_KEY, "{not-json");
    expect(service.cargar()).toBeNull();
  });

  it("removes the stored draft", () => {
    service.guardar(borrador);
    service.eliminar();
    expect(service.cargar()).toBeNull();
  });
});
