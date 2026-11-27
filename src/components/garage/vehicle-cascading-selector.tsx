"use client";

import { useState, useMemo, useEffect } from "react";
import {
  lookupMakes,
  lookupModels,
  lookupGenerations,
  lookupYears,
  lookupBodyTypes,
  lookupEngines,
  lookupModifications,
  resolveMakeIdByName,
  resolveModelIdByName,
  type VehicleMake,
  type VehicleModel,
  type VehicleGeneration,
  type VehicleEngine,
  type VehicleModification,
} from "@/lib/garage/vehicle-catalog";
import {
  BODY_TYPE_LABELS,
  POPULAR_CAR_COLORS,
  type BodyType,
} from "@/lib/garage/vehicle-visual-registry";
import { VehicleSideView } from "./vehicle-side-view";

export type VehicleSelectorValues = {
  make: string;
  model: string;
  generation: string;
  year: number | "";
  bodyType: string;
  engine: string;
  modification: string;
  vin: string;
  colorName: string;
  colorCode: string;
  colorHex: string;
  isDefault: boolean;
  vehicleMakeId?: string;
  vehicleModelId?: string;
  vehicleGenerationId?: string;
  vehicleModificationId?: string;
};

export interface VehicleCascadingSelectorProps {
  initialValues?: Partial<VehicleSelectorValues>;
  onSubmit: (values: VehicleSelectorValues) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
  submitButtonText?: string;
  title?: string;
}

type DbMake = {
  id: string;
  name: string;
  nameRu?: string | null;
  country: string;
  isPopular?: boolean;
};

type DbModel = {
  id: string;
  makeId: string;
  name: string;
  nameRu?: string | null;
};

type DbGeneration = {
  id: string;
  modelId: string;
  name: string;
  shortName?: string | null;
  yearStart: number;
  yearEnd: number | null;
  defaultBodyType?: string | null;
  years: number[];
};

type DbEngine = {
  id: string;
  generationId: string;
  name: string;
  code?: string | null;
  fuelType?: string | null;
};

type DbModification = {
  id: string;
  generationId: string;
  engineId?: string | null;
  name: string;
  transmission: string;
  drivetrain: string;
};

export function VehicleCascadingSelector({
  initialValues,
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitButtonText = "Сохранить автомобиль",
  title = "Добавление автомобиля в ZAPTUT GARAGE",
}: VehicleCascadingSelectorProps) {
  // Selected IDs in catalog tree
  const [selectedMakeId, setSelectedMakeId] = useState<string>(() => {
    return initialValues?.vehicleMakeId || (initialValues?.make ? resolveMakeIdByName(initialValues.make) || "" : "");
  });
  const [selectedModelId, setSelectedModelId] = useState<string>(() => {
    if (initialValues?.vehicleModelId) return initialValues.vehicleModelId;
    if (initialValues?.make && initialValues?.model) {
      const mId = resolveMakeIdByName(initialValues.make);
      return mId ? resolveModelIdByName(mId, initialValues.model) || "" : "";
    }
    return "";
  });
  const [selectedGenerationId, setSelectedGenerationId] = useState<string>(
    initialValues?.vehicleGenerationId || ""
  );
  const [selectedModId, setSelectedModId] = useState<string>(
    initialValues?.vehicleModificationId || ""
  );

  // Form values
  const [make, setMake] = useState(initialValues?.make || "");
  const [model, setModel] = useState(initialValues?.model || "");
  const [generation, setGeneration] = useState(initialValues?.generation || "");
  const [year, setYear] = useState<number | "">(initialValues?.year ?? "");
  const [bodyType, setBodyType] = useState<string>(initialValues?.bodyType || "SUV");
  const [engineId, setEngineId] = useState<string>("");
  const [engine, setEngine] = useState(initialValues?.engine || "");
  const [modification, setModification] = useState(initialValues?.modification || "");
  const [vin, setVin] = useState(initialValues?.vin || "");
  const [colorName, setColorName] = useState(initialValues?.colorName || POPULAR_CAR_COLORS[0].name);
  const [colorCode, setColorCode] = useState(initialValues?.colorCode || POPULAR_CAR_COLORS[0].code || "");
  const [colorHex, setColorHex] = useState(initialValues?.colorHex || POPULAR_CAR_COLORS[0].hex);
  const [isDefault, setIsDefault] = useState(initialValues?.isDefault ?? false);

  // Search filter inputs for searchable dropdowns
  const [makeSearch, setMakeSearch] = useState("");
  const [modelSearch, setModelSearch] = useState("");
  const [generationSearch, setGenerationSearch] = useState("");
  const [engineSearch, setEngineSearch] = useState("");
  const [modSearch, setModSearch] = useState("");

  const [formError, setFormError] = useState<string | null>(null);

  // Database-backed state fetched via /api/customer/vehicle-catalog
  const [dbMakes, setDbMakes] = useState<DbMake[]>([]);
  const [dbModels, setDbModels] = useState<DbModel[]>([]);
  const [dbGenerations, setDbGenerations] = useState<DbGeneration[]>([]);
  const [dbYears, setDbYears] = useState<number[]>([]);
  const [dbBodyTypes, setDbBodyTypes] = useState<string[]>([]);
  const [dbEngines, setDbEngines] = useState<DbEngine[]>([]);
  const [dbModifications, setDbModifications] = useState<DbModification[]>([]);

  // 1. Fetch Makes from DB
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    async function loadMakes() {
      try {
        const queryParam = makeSearch.trim() ? `&query=${encodeURIComponent(makeSearch.trim())}` : "";
        const res = await fetch(`/api/customer/vehicle-catalog?step=makes${queryParam}`, {
          signal: controller.signal,
        });
        if (res.ok && active) {
          const data = await res.json();
          if (Array.isArray(data.makes) && data.makes.length > 0) {
            setDbMakes(data.makes);
          }
        }
      } catch {
        // Fallback to static
      }
    }
    loadMakes();
    return () => {
      active = false;
      controller.abort();
    };
  }, [makeSearch]);

  // 2. Fetch Models when make selected
  useEffect(() => {
    if (!selectedMakeId) {
      setDbModels([]);
      return;
    }
    let active = true;
    const controller = new AbortController();
    async function loadModels() {
      try {
        const queryParam = modelSearch.trim() ? `&query=${encodeURIComponent(modelSearch.trim())}` : "";
        const res = await fetch(
          `/api/customer/vehicle-catalog?step=models&makeId=${encodeURIComponent(selectedMakeId)}${queryParam}`,
          { signal: controller.signal }
        );
        if (res.ok && active) {
          const data = await res.json();
          if (Array.isArray(data.models)) {
            setDbModels(data.models);
          }
        }
      } catch {
        // Fallback
      }
    }
    loadModels();
    return () => {
      active = false;
      controller.abort();
    };
  }, [selectedMakeId, modelSearch]);

  // 3. Fetch Generations when model selected
  useEffect(() => {
    if (!selectedModelId) {
      setDbGenerations([]);
      return;
    }
    let active = true;
    const controller = new AbortController();
    async function loadGenerations() {
      try {
        const queryParam = generationSearch.trim() ? `&query=${encodeURIComponent(generationSearch.trim())}` : "";
        const res = await fetch(
          `/api/customer/vehicle-catalog?step=generations&modelId=${encodeURIComponent(selectedModelId)}${queryParam}`,
          { signal: controller.signal }
        );
        if (res.ok && active) {
          const data = await res.json();
          if (Array.isArray(data.generations)) {
            setDbGenerations(data.generations);
          }
        }
      } catch {}
    }
    loadGenerations();
    return () => {
      active = false;
      controller.abort();
    };
  }, [selectedModelId, generationSearch]);

  const availableGenerations = useMemo(() => {
    if (dbGenerations.length > 0) return dbGenerations;
    if (!selectedModelId) return [];
    return lookupGenerations(selectedModelId, generationSearch);
  }, [dbGenerations, selectedModelId, generationSearch]);

  // 4. Fetch Options (years, bodyTypes, engines, modifications) when generation OR model fallback selected
  useEffect(() => {
    if (!selectedGenerationId && (!selectedModelId || availableGenerations.length > 0)) {
      setDbYears([]);
      setDbBodyTypes([]);
      setDbEngines([]);
      setDbModifications([]);
      return;
    }
    let active = true;
    const controller = new AbortController();
    async function loadOptions() {
      try {
        const param = selectedGenerationId
          ? `generationId=${encodeURIComponent(selectedGenerationId)}`
          : `modelId=${encodeURIComponent(selectedModelId)}`;
        const res = await fetch(
          `/api/customer/vehicle-catalog?step=options&${param}`,
          { signal: controller.signal }
        );
        if (res.ok && active) {
          const data = await res.json();
          if (Array.isArray(data.years)) setDbYears(data.years);
          if (Array.isArray(data.bodyTypes)) setDbBodyTypes(data.bodyTypes);
          if (Array.isArray(data.engines)) setDbEngines(data.engines);
          if (Array.isArray(data.modifications)) setDbModifications(data.modifications);
        }
      } catch {}
    }
    loadOptions();
    return () => {
      active = false;
      controller.abort();
    };
  }, [selectedGenerationId, selectedModelId, availableGenerations.length]);

  // Fallback / Combined Catalogs
  const availableMakes = useMemo(() => {
    if (dbMakes.length > 0) return dbMakes;
    return lookupMakes(makeSearch);
  }, [dbMakes, makeSearch]);

  const availableModels = useMemo(() => {
    if (dbModels.length > 0) return dbModels;
    if (!selectedMakeId) return [];
    return lookupModels(selectedMakeId, modelSearch);
  }, [dbModels, selectedMakeId, modelSearch]);

  const availableYears = useMemo(() => {
    if (dbYears.length > 0) return dbYears;
    if (!selectedGenerationId) return [];
    return lookupYears(selectedGenerationId);
  }, [dbYears, selectedGenerationId]);

  const availableBodyTypes = useMemo(() => {
    if (dbBodyTypes.length > 0) return dbBodyTypes;
    if (!selectedGenerationId) return [];
    return lookupBodyTypes(selectedGenerationId);
  }, [dbBodyTypes, selectedGenerationId]);

  const availableEngines = useMemo(() => {
    if (dbEngines.length > 0) return dbEngines;
    if (!selectedGenerationId) return [];
    return lookupEngines(selectedGenerationId, engineSearch);
  }, [dbEngines, selectedGenerationId, engineSearch]);

  const availableModifications = useMemo(() => {
    if (dbModifications.length > 0) return dbModifications;
    if (!selectedGenerationId) return [];
    return lookupModifications(selectedGenerationId, engineId || undefined, modSearch);
  }, [dbModifications, selectedGenerationId, engineId, modSearch]);

  // Cascading Handlers
  const handleMakeChange = (mId: string) => {
    setSelectedMakeId(mId);
    const found = availableMakes.find((m) => m.id === mId);
    setMake(found ? found.name : "");

    // Reset all downstream
    setSelectedModelId("");
    setModel("");
    setSelectedGenerationId("");
    setGeneration("");
    setYear("");
    setBodyType("SUV");
    setEngineId("");
    setEngine("");
    setSelectedModId("");
    setModification("");
    setFormError(null);
  };

  const handleModelChange = (moId: string) => {
    setSelectedModelId(moId);
    const found = availableModels.find((m) => m.id === moId);
    setModel(found ? found.name : "");

    // Reset downstream
    setSelectedGenerationId("");
    setGeneration("");
    setYear("");
    setBodyType("SUV");
    setEngineId("");
    setEngine("");
    setSelectedModId("");
    setModification("");
    setFormError(null);
  };

  const handleGenerationChange = (genId: string) => {
    setSelectedGenerationId(genId);
    const found = availableGenerations.find((g) => g.id === genId);
    if (found) {
      setGeneration(found.name);
      if (found.defaultBodyType) {
        setBodyType(found.defaultBodyType);
      }
      if (found.years && found.years.length > 0) {
        setYear(found.years[0]);
      } else {
        setYear("");
      }
    } else {
      setGeneration("");
      setYear("");
      setBodyType("SUV");
    }

    setEngineId("");
    setEngine("");
    setSelectedModId("");
    setModification("");
    setFormError(null);
  };

  const handleEngineChange = (eId: string) => {
    setEngineId(eId);
    const found = availableEngines.find((e) => e.id === eId);
    setEngine(found ? found.name : "");
    setSelectedModId("");
    setModification("");
  };

  const handleModificationChange = (val: string) => {
    setModification(val);
    const found = availableModifications.find((m) => m.name === val || m.id === val);
    if (found) {
      setSelectedModId(found.id);
      setModification(found.name);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!make) {
      setFormError("Шаг 1: Выберите марку автомобиля.");
      return;
    }
    if (!model) {
      setFormError("Шаг 2: Выберите модель автомобиля.");
      return;
    }
    if (!generation && availableGenerations.length > 0) {
      setFormError("Шаг 3: Выберите поколение автомобиля.");
      return;
    }

    const cleanVin = vin.trim().toUpperCase();
    if (cleanVin && (cleanVin.length < 5 || cleanVin.length > 25)) {
      setFormError("VIN-номер должен содержать от 5 до 25 символов (или оставьте поле пустым).");
      return;
    }

    await onSubmit({
      make,
      model,
      generation,
      year: year === "" ? "" : Number(year),
      bodyType,
      engine,
      modification,
      vin: cleanVin,
      colorName,
      colorCode,
      colorHex,
      isDefault,
      vehicleMakeId: selectedMakeId || undefined,
      vehicleModelId: selectedModelId || undefined,
      vehicleGenerationId: selectedGenerationId || undefined,
      vehicleModificationId: selectedModId || undefined,
    });
  };

  const inputClass =
    "w-full border border-[#383e41] bg-[#17191b] px-3 py-2 text-xs text-[#f1f0eb] outline-none transition focus:border-[#ff6428] disabled:cursor-not-allowed disabled:opacity-40 disabled:bg-[#1f2224]";

  return (
    <form onSubmit={handleSubmit} className="space-y-5 text-[#f1f0eb]">
      {/* Header with Title and Live Compact Vehicle Projection */}
      <div className="flex flex-col gap-3 rounded border border-[#383e41] bg-[#17191b] p-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[.22em] text-[#ff6428]">
            ZAPTUT GARAGE · ПОДБОР ПО СПРАВОЧНИКУ
          </p>
          <h3 className="mt-1 text-base font-black uppercase text-[#f1f0eb] sm:text-lg">
            {make && model ? `${make} ${model}` : "Выбор автомобиля"}
          </h3>
          <p className="mt-0.5 text-xs text-[#888b8d]">
            {[
              generation,
              year ? `${year} г.` : null,
              bodyType ? (BODY_TYPE_LABELS[bodyType as BodyType] || bodyType) : null,
            ]
              .filter(Boolean)
              .join(" · ") || "Выберите параметры автомобиля последовательно"}
          </p>
        </div>

        {/* Live compact 2D side-view preview */}
        <div className="w-[200px] sm:w-[220px] max-w-[240px] shrink-0 self-center sm:self-auto">
          <VehicleSideView
            make={make || "Kia"}
            model={model || "Sportage"}
            generation={generation}
            bodyType={bodyType}
            colorHex={colorHex || "#2E3338"}
            className="w-full h-auto"
          />
        </div>
      </div>

      {formError && (
        <div className="border border-red-900/60 bg-red-950/20 px-3 py-2 text-xs text-red-300">
          {formError}
        </div>
      )}

      {/* 7-Step Sequential Dropdowns */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        {/* 1. Марка автомобиля */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-[#aeb5b6]">
            1. Марка автомобиля <span className="text-[#ff6428]">*</span>
          </label>
          <div className="mt-1 space-y-1">
            <input
              type="text"
              placeholder="Поиск марки (Лада, Haval, Geely, Kia, Toyota...)"
              value={makeSearch}
              onChange={(e) => setMakeSearch(e.target.value)}
              className="w-full border border-[#2d3235] bg-[#141618] px-2.5 py-1 text-[11px] text-[#f1f0eb] placeholder:text-[#52595c] focus:border-[#ff6428] focus:outline-none"
            />
            <select
              value={selectedMakeId}
              onChange={(e) => handleMakeChange(e.target.value)}
              className={inputClass}
              required
            >
              <option value="">— Выберите марку ({availableMakes.length}) —</option>
              {availableMakes.map((m) => {
                const nameRu = "nameRu" in m && m.nameRu ? ` (${m.nameRu})` : "";
                return (
                  <option key={m.id} value={m.id}>
                    {m.name}{nameRu} · {m.country}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* 2. Модель */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-[#aeb5b6]">
            2. Модель <span className="text-[#ff6428]">*</span>
          </label>
          <div className="mt-1 space-y-1">
            <input
              type="text"
              placeholder="Поиск модели (Vesta, Granta, Camry, Jolion...)"
              value={modelSearch}
              onChange={(e) => setModelSearch(e.target.value)}
              disabled={!selectedMakeId}
              className="w-full border border-[#2d3235] bg-[#141618] px-2.5 py-1 text-[11px] text-[#f1f0eb] placeholder:text-[#52595c] focus:border-[#ff6428] focus:outline-none disabled:opacity-40"
            />
            <select
              value={selectedModelId}
              onChange={(e) => handleModelChange(e.target.value)}
              disabled={!selectedMakeId}
              className={inputClass}
              required
            >
              <option value="">
                {!selectedMakeId ? "← Сначала выберите марку" : `— Выберите модель (${availableModels.length}) —`}
              </option>
              {availableModels.map((mo) => {
                const nameRu = "nameRu" in mo && mo.nameRu ? ` (${mo.nameRu})` : "";
                return (
                  <option key={mo.id} value={mo.id}>
                    {mo.name}{nameRu}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* 3. Поколение */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-[#aeb5b6]">
            3. Поколение {availableGenerations.length > 0 && <span className="text-[#ff6428]">*</span>}
          </label>
          <select
            value={selectedGenerationId}
            onChange={(e) => handleGenerationChange(e.target.value)}
            disabled={!selectedModelId || availableGenerations.length === 0}
            className={`${inputClass} mt-1`}
            required={availableGenerations.length > 0}
          >
            <option value="">
              {!selectedModelId
                ? "← Сначала выберите модель"
                : availableGenerations.length === 0
                ? "— Базовый учёт (без поколений) —"
                : `— Выберите поколение (${availableGenerations.length}) —`}
            </option>
            {availableGenerations.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} [{g.yearStart}–{g.yearEnd || "н.в."}]
              </option>
            ))}
          </select>
        </div>

        {/* 4. Год выпуска */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-[#aeb5b6]">
            4. Год выпуска <span className="text-[#ff6428]">*</span>
          </label>
          <select
            value={year}
            onChange={(e) => setYear(e.target.value ? Number(e.target.value) : "")}
            disabled={!selectedModelId || (availableGenerations.length > 0 && !selectedGenerationId)}
            className={`${inputClass} mt-1`}
            required={availableYears.length > 0}
          >
            <option value="">
              {!selectedModelId
                ? "← Сначала выберите модель"
                : availableGenerations.length > 0 && !selectedGenerationId
                ? "← Сначала выберите поколение"
                : "— Выберите год —"}
            </option>
            {availableYears.map((y) => (
              <option key={y} value={y}>
                {y} год
              </option>
            ))}
          </select>
        </div>

        {/* 5. Тип кузова */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-[#aeb5b6]">
            5. Тип кузова
          </label>
          <select
            value={bodyType}
            onChange={(e) => setBodyType(e.target.value)}
            disabled={!selectedModelId || (availableGenerations.length > 0 && !selectedGenerationId)}
            className={`${inputClass} mt-1`}
          >
            {availableBodyTypes.length > 0 ? (
              availableBodyTypes.map((bt) => (
                <option key={bt} value={bt}>
                  {BODY_TYPE_LABELS[bt as BodyType] || bt}
                </option>
              ))
            ) : (
              <option value="SUV">Внедорожник / Кроссовер</option>
            )}
          </select>
        </div>

        {/* 6. Двигатель */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-[#aeb5b6]">
            6. Двигатель (ДВС / Гибрид)
          </label>
          <select
            value={engineId}
            onChange={(e) => handleEngineChange(e.target.value)}
            disabled={!selectedGenerationId}
            className={`${inputClass} mt-1`}
          >
            <option value="">
              {!selectedGenerationId ? "← Сначала выберите поколение" : "— Любой / Не выбран —"}
            </option>
            {availableEngines.map((eng) => (
              <option key={eng.id} value={eng.id}>
                {eng.name}
              </option>
            ))}
          </select>
        </div>

        {/* 7. Модификация (КПП и привод) */}
        <div className="sm:col-span-2">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-[#aeb5b6]">
            7. Модификация (Трансмиссия и привод)
          </label>
          <select
            value={modification}
            onChange={(e) => handleModificationChange(e.target.value)}
            disabled={!selectedGenerationId}
            className={`${inputClass} mt-1`}
          >
            <option value="">
              {!selectedGenerationId ? "← Сначала выберите поколение" : "— Выберите модификацию —"}
            </option>
            {availableModifications.map((mod) => (
              <option key={mod.id} value={mod.name}>
                {mod.name} · {mod.transmission} · {mod.drivetrain}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Additional Parameters: VIN & Color */}
      <div className="space-y-4 border-t border-[#383e41] pt-4">
        {/* VIN-номер (необязательный) */}
        <div>
          <div className="flex items-center justify-between">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#aeb5b6]">
              VIN-номер кузова (необязательно)
            </label>
            <span className="text-[10px] text-[#888b8d]">17 символов для точного подбора</span>
          </div>
          <input
            type="text"
            placeholder="Например: XWEPH811DM0014801 (необязательно)"
            value={vin}
            onChange={(e) => setVin(e.target.value.toUpperCase())}
            maxLength={25}
            className={`${inputClass} mt-1 font-mono uppercase tracking-wider`}
          />
        </div>

        {/* Выбор цвета кузова */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-[#aeb5b6]">
            Цвет кузова для 2D-макета: <span className="text-[#f1f0eb]">{colorName}</span>
          </label>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {POPULAR_CAR_COLORS.map((c) => {
              const active = colorHex.toLowerCase() === c.hex.toLowerCase();
              return (
                <button
                  key={c.name}
                  type="button"
                  title={`${c.name} (${c.hex})`}
                  onClick={() => {
                    setColorName(c.name);
                    setColorHex(c.hex);
                    setColorCode(c.code || "");
                  }}
                  className={`group relative h-7 w-7 rounded-full border-2 transition ${
                    active ? "scale-110 border-[#ff6428] ring-2 ring-[#ff6428]/40" : "border-[#383e41] hover:scale-105 hover:border-[#888b8d]"
                  }`}
                  style={{ backgroundColor: c.hex }}
                >
                  {active && (
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-white drop-shadow">
                      ✓
                    </span>
                  )}
                </button>
              );
            })}

            {/* Custom HEX Color Picker */}
            <label className="flex cursor-pointer items-center gap-1.5 rounded border border-[#383e41] bg-[#141618] px-2.5 py-1 text-[11px] text-[#888b8d] transition hover:border-[#ff6428] hover:text-[#f1f0eb]">
              <span>HEX:</span>
              <input
                type="color"
                value={colorHex}
                onChange={(e) => {
                  setColorHex(e.target.value);
                  setColorName("Пользовательский");
                  setColorCode("");
                }}
                className="h-4 w-5 cursor-pointer bg-transparent p-0 border-0"
              />
              <span className="font-mono text-[10px] text-[#f1f0eb]">{colorHex.toUpperCase()}</span>
            </label>
          </div>
        </div>

        {/* Основной автомобиль */}
        <label className="flex cursor-pointer items-center gap-2.5 pt-1">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
            className="h-4 w-4 rounded border-[#383e41] bg-[#17191b] text-[#ff6428] focus:ring-0 focus:ring-offset-0"
          />
          <span className="text-xs text-[#dcded8]">
            Сделать основным автомобилем гаража (показывается первым на главной)
          </span>
        </label>
      </div>

      {/* Buttons */}
      <div className="flex flex-col-reverse gap-2.5 pt-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="rounded border border-[#383e41] bg-[#1d2022] px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#aeb5b6] transition hover:border-[#888b8d] hover:text-[#f1f0eb] disabled:opacity-50"
        >
          Отмена
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded border border-[#ff6428] bg-[#ff6428] px-5 py-2 text-xs font-bold uppercase tracking-wider text-[#17191b] transition hover:bg-[#e0551e] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? "Сохранение..." : submitButtonText}
        </button>
      </div>
    </form>
  );
}
