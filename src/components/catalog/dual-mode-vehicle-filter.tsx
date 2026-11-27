"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SearchableCombobox, type ComboboxOption } from "@/components/ui/searchable-combobox";
import { BODY_TYPE_LABELS, type BodyType } from "@/lib/garage/vehicle-visual-registry";

export type VehicleFilterSelection = {
  makeId: string;
  make: string;
  modelId: string;
  model: string;
  generationId: string;
  generation: string;
  year: string;
  yearSemantics?: string;
  bodyType: string;
  engineId: string;
  engine: string;
  modificationId: string;
  modification: string;
};

export const emptyVehicleFilterSelection: VehicleFilterSelection = {
  makeId: "",
  make: "",
  modelId: "",
  model: "",
  generationId: "",
  generation: "",
  year: "",
  yearSemantics: "",
  bodyType: "",
  engineId: "",
  engine: "",
  modificationId: "",
  modification: "",
};

export const YEAR_SEMANTIC_LABELS: Record<string, string> = {
  MODEL_YEAR: "Модельный год",
  PRODUCTION_YEAR: "Год производства",
  REGISTRATION_YEAR: "Год регистрации",
  CATALOG_YEAR: "Год по каталогу",
  MIXED: "Годы по реестрам",
};

export const YEAR_SEMANTIC_SHORT: Record<string, string> = {
  MODEL_YEAR: "модельный год",
  PRODUCTION_YEAR: "год производства",
  REGISTRATION_YEAR: "год регистрации",
  CATALOG_YEAR: "год по каталогу",
  MIXED: "год по реестру",
};

type DbMake = {
  id: string;
  name: string;
  nameRu?: string | null;
  country: string | null;
  isPopular?: boolean;
  aliases?: string[];
  modelsCount?: number;
};

type DbModel = {
  id: string;
  makeId: string;
  name: string;
  nameRu?: string | null;
  yearFrom?: number | null;
  yearTo?: number | null;
  yearSemantics?: string | null;
  bodyTypes?: string[];
  isPopular?: boolean;
  aliases?: string[];
  generationsCount?: number;
};

type DbGeneration = {
  id: string;
  modelId: string;
  name: string;
  shortName?: string | null;
  code?: string | null;
  yearStart: number;
  yearEnd: number | null;
  defaultBodyType?: string | null;
  years?: number[];
};

type DbEngine = {
  id: string;
  generationId: string;
  name: string;
  code?: string | null;
  fuelType?: string | null;
  displacementCc?: number | null;
  powerHp?: number | null;
};

type DbModification = {
  id: string;
  generationId: string;
  engineId?: string | null;
  name: string;
  bodyType?: string | null;
  transmission?: string | null;
  drivetrain?: string | null;
  yearFrom?: number | null;
  yearTo?: number | null;
};

type CombinedMatch = {
  makeId: string;
  makeName: string;
  makeNameRu?: string | null;
  country: string;
  modelId: string;
  modelName: string;
  modelNameRu?: string | null;
  yearFrom?: number | null;
  yearTo?: number | null;
  yearSemantics?: string | null;
};

const FUEL_LABELS: Record<string, string> = {
  PETROL: "Бензин",
  DIESEL: "Дизель",
  HYBRID: "Гибрид",
  ELECTRIC: "Электро",
  GAS: "Газ",
};

export function DualModeVehicleFilter({
  value,
  onChange,
}: {
  value: VehicleFilterSelection;
  onChange: (next: VehicleFilterSelection) => void;
}) {
  const [makes, setMakes] = useState<DbMake[]>([]);
  const [makesLoading, setMakesLoading] = useState(false);
  const [makesError, setMakesError] = useState<string | null>(null);

  const [models, setModels] = useState<DbModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);

  const [generations, setGenerations] = useState<DbGeneration[]>([]);
  const [generationsLoading, setGenerationsLoading] = useState(false);
  const [generationsError, setGenerationsError] = useState<string | null>(null);

  const [years, setYears] = useState<number[]>([]);
  const [yearSemantics, setYearSemantics] = useState<string | null>(null);
  const [bodyTypes, setBodyTypes] = useState<string[]>([]);
  const [engines, setEngines] = useState<DbEngine[]>([]);
  const [modifications, setModifications] = useState<DbModification[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  // Combined search results when user types e.g. "Toyota Camry" or "Тойота Камри" in Make field
  const [combinedMatches, setCombinedMatches] = useState<CombinedMatch[]>([]);
  const combinedTimerRef = useRef<number | null>(null);

  // 1. Load ALL makes on mount from PostgreSQL Vehicle Database
  useEffect(() => {
    let active = true;
    setMakesLoading(true);
    setMakesError(null);
    fetch("/api/customer/vehicle-catalog?step=makes")
      .then((res) => {
        if (!res.ok) throw new Error("Не удалось загрузить список марок");
        return res.json();
      })
      .then((data) => {
        if (!active) return;
        if (Array.isArray(data.makes)) setMakes(data.makes);
      })
      .catch((err) => {
        if (active) setMakesError(err instanceof Error ? err.message : "Ошибка загрузки марок");
      })
      .finally(() => {
        if (active) setMakesLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  // Resolve makeId if initial value.make came from URL query (e.g. ?make=Kia) without makeId
  useEffect(() => {
    if (value.make && !value.makeId && makes.length > 0) {
      const target = value.make.trim().toLowerCase();
      const found = makes.find(
        (m) =>
          m.name.toLowerCase() === target ||
          (m.nameRu && m.nameRu.toLowerCase() === target) ||
          m.aliases?.some((a) => a.toLowerCase() === target)
      );
      if (found) {
        onChange({ ...value, makeId: found.id, make: found.name });
      }
    }
  }, [value, makes, onChange]);

  // 2. Load ALL models for selected makeId
  useEffect(() => {
    if (!value.makeId) {
      setModels([]);
      return;
    }
    let active = true;
    setModelsLoading(true);
    setModelsError(null);

    fetch(`/api/customer/vehicle-catalog?step=models&makeId=${encodeURIComponent(value.makeId)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Не удалось загрузить список моделей");
        return res.json();
      })
      .then((data) => {
        if (!active) return;
        if (Array.isArray(data.models)) setModels(data.models);
      })
      .catch((err) => {
        if (active) setModelsError(err instanceof Error ? err.message : "Ошибка загрузки моделей");
      })
      .finally(() => {
        if (active) setModelsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [value.makeId]);

  // 3. Load generations for selected modelId
  useEffect(() => {
    if (!value.modelId) {
      setGenerations([]);
      return;
    }
    let active = true;
    setGenerationsLoading(true);
    setGenerationsError(null);

    fetch(`/api/customer/vehicle-catalog?step=generations&modelId=${encodeURIComponent(value.modelId)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Не удалось загрузить поколения");
        return res.json();
      })
      .then((data) => {
        if (!active) return;
        if (Array.isArray(data.generations)) setGenerations(data.generations);
      })
      .catch((err) => {
        if (active) setGenerationsError(err instanceof Error ? err.message : "Ошибка загрузки поколений");
      })
      .finally(() => {
        if (active) setGenerationsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [value.modelId]);

  // 4. Load years, bodyTypes, engines, modifications for selected generationId OR fallback modelId
  useEffect(() => {
    const canUseModelFallback =
      Boolean(value.modelId) && !value.generationId && !generationsLoading && generations.length === 0;

    if (!value.generationId && !canUseModelFallback) {
      setYears([]);
      setYearSemantics(null);
      setBodyTypes([]);
      setEngines([]);
      setModifications([]);
      return;
    }
    let active = true;
    setOptionsLoading(true);
    setOptionsError(null);

    const params = new URLSearchParams({ step: "options" });
    if (value.generationId) {
      params.set("generationId", value.generationId);
      if (value.engineId) params.set("engineId", value.engineId);
    } else if (value.modelId) {
      params.set("modelId", value.modelId);
    }

    fetch(`/api/customer/vehicle-catalog?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error("Не удалось загрузить параметры модификации");
        return res.json();
      })
      .then((data) => {
        if (!active) return;
        setYears(Array.isArray(data.years) ? data.years : []);
        const sem =
          typeof data.yearSemantics === "string"
            ? data.yearSemantics
            : value.generationId
            ? "PRODUCTION_YEAR"
            : null;
        setYearSemantics(sem);
        setBodyTypes(Array.isArray(data.bodyTypes) ? data.bodyTypes : []);
        setEngines(Array.isArray(data.engines) ? data.engines : []);
        setModifications(Array.isArray(data.modifications) ? data.modifications : []);
      })
      .catch((err) => {
        if (active) setOptionsError(err instanceof Error ? err.message : "Ошибка загрузки характеристик");
      })
      .finally(() => {
        if (active) setOptionsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [value.generationId, value.engineId, value.modelId, generationsLoading, generations.length]);

  function handleMakeQueryChange(q: string) {
    if (combinedTimerRef.current) window.clearTimeout(combinedTimerRef.current);
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setCombinedMatches([]);
      return;
    }
    combinedTimerRef.current = window.setTimeout(() => {
      fetch(`/api/customer/vehicle-catalog?step=combined&query=${encodeURIComponent(trimmed)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && Array.isArray(data.matches)) {
            setCombinedMatches(data.matches);
          }
        })
        .catch(() => {});
    }, 180);
  }

  const makeOptions: ComboboxOption[] = useMemo(
    () =>
      makes.map((m) => ({
        id: m.id,
        label: m.name,
        secondaryLabel:
          m.nameRu && m.nameRu !== m.name
            ? [m.nameRu, m.country].filter(Boolean).join(" · ")
            : m.country || undefined,
        badge: m.modelsCount ? `${m.modelsCount} мод.` : undefined,
        searchTerms: [m.name, m.nameRu || "", ...(m.aliases || [])],
        meta: m,
      })),
    [makes]
  );

  const combinedOptions: ComboboxOption[] = useMemo(
    () =>
      combinedMatches.map((cm) => ({
        id: `${cm.makeId}::${cm.modelId}`,
        label: `${cm.makeName} ${cm.modelName}`,
        secondaryLabel: [cm.makeNameRu, cm.modelNameRu].filter(Boolean).join(" ") || cm.country,
        badge: cm.yearFrom ? `${cm.yearFrom}–${cm.yearTo || "н.в."}` : "Марка + модель",
        meta: cm,
      })),
    [combinedMatches]
  );

  const modelOptions: ComboboxOption[] = useMemo(
    () =>
      models.map((mo) => ({
        id: mo.id,
        label: mo.name,
        secondaryLabel: mo.nameRu && mo.nameRu !== mo.name ? mo.nameRu : undefined,
        badge: mo.yearFrom ? `${mo.yearFrom}–${mo.yearTo || "н.в."}` : undefined,
        searchTerms: [mo.name, mo.nameRu || "", ...(mo.aliases || [])],
        meta: mo,
      })),
    [models]
  );

  const generationOptions: ComboboxOption[] = useMemo(
    () =>
      generations.map((g) => ({
        id: g.id,
        label: g.shortName || g.name,
        secondaryLabel: `${g.yearStart}–${g.yearEnd || "н.в."}${g.code ? ` · ${g.code}` : ""}`,
        searchTerms: [g.name, g.shortName || "", g.code || ""],
        meta: g,
      })),
    [generations]
  );

  const yearOptions: ComboboxOption[] = useMemo(
    () =>
      years.map((y) => ({
        id: String(y),
        label: String(y),
        searchTerms: [String(y)],
      })),
    [years]
  );

  const bodyTypeOptions: ComboboxOption[] = useMemo(
    () =>
      bodyTypes.map((code) => ({
        id: code,
        label: BODY_TYPE_LABELS[code as BodyType] || code,
        secondaryLabel: BODY_TYPE_LABELS[code as BodyType] ? code : undefined,
        searchTerms: [code, BODY_TYPE_LABELS[code as BodyType] || ""],
      })),
    [bodyTypes]
  );

  const engineOptions: ComboboxOption[] = useMemo(
    () =>
      engines.map((e) => ({
        id: e.id,
        label: e.name,
        secondaryLabel: [e.code, e.fuelType ? FUEL_LABELS[e.fuelType] || e.fuelType : null, e.powerHp ? `${e.powerHp} л.с.` : null]
          .filter(Boolean)
          .join(" · "),
        searchTerms: [e.name, e.code || "", e.fuelType ? FUEL_LABELS[e.fuelType] || "" : ""],
        meta: e,
      })),
    [engines]
  );

  const modificationOptions: ComboboxOption[] = useMemo(
    () =>
      modifications.map((mod) => ({
        id: mod.id,
        label: mod.name,
        secondaryLabel: [mod.transmission, mod.drivetrain].filter(Boolean).join(" · ") || undefined,
        searchTerms: [mod.name, mod.transmission || "", mod.drivetrain || ""],
        meta: mod,
      })),
    [modifications]
  );

  return (
    <div className="grid gap-3.5" data-testid="dual-mode-vehicle-filter">
      {/* 1. Make */}
      <SearchableCombobox
        testId="vehicle-combobox-make"
        label="Марка автомобиля"
        placeholder="Выберите или введите (BMW, Тойота…)"
        options={makeOptions}
        valueId={value.makeId}
        displayValue={value.make}
        loading={makesLoading}
        error={makesError}
        emptyText="Марка не найдена в базе"
        extraOptions={combinedOptions}
        extraSectionLabel="Быстрый выбор: марка + модель"
        onQueryChange={handleMakeQueryChange}
        onSelectExtra={(opt) => {
          const cm = opt.meta as CombinedMatch;
          setCombinedMatches([]);
          onChange({
            ...emptyVehicleFilterSelection,
            makeId: cm.makeId,
            make: cm.makeName,
            modelId: cm.modelId,
            model: cm.modelName,
            yearSemantics: cm.yearSemantics || "",
          });
        }}
        onSelect={(opt) => {
          setCombinedMatches([]);
          if (!opt) {
            onChange(emptyVehicleFilterSelection);
            return;
          }
          const mk = opt.meta as DbMake;
          onChange({
            ...emptyVehicleFilterSelection,
            makeId: mk.id,
            make: mk.name,
          });
        }}
      />

      {/* 2. Model */}
      {value.makeId && (
        <SearchableCombobox
          testId="vehicle-combobox-model"
          label="Модель"
          placeholder="Выберите или введите (Camry, Веста…)"
          options={modelOptions}
          valueId={value.modelId}
          displayValue={value.model}
          loading={modelsLoading}
          error={modelsError}
          emptyText="Модели не найдены"
          onSelect={(opt) => {
            if (!opt) {
              onChange({
                ...emptyVehicleFilterSelection,
                makeId: value.makeId,
                make: value.make,
              });
              return;
            }
            const mo = opt.meta as DbModel;
            onChange({
              ...emptyVehicleFilterSelection,
              makeId: value.makeId,
              make: value.make,
              modelId: mo.id,
              model: mo.name,
              yearSemantics: mo.yearSemantics || "",
            });
          }}
        />
      )}

      {/* 3. Generation (rendered when model has generations in DB) */}
      {value.modelId && (generationsLoading || generations.length > 0) && (
        <SearchableCombobox
          testId="vehicle-combobox-generation"
          label="Поколение"
          placeholder="Выберите или введите поколение…"
          options={generationOptions}
          valueId={value.generationId}
          displayValue={value.generation}
          loading={generationsLoading}
          error={generationsError}
          emptyText="Поколения не найдены"
          minSearchLength={1}
          onSelect={(opt) => {
            if (!opt) {
              onChange({
                ...value,
                generationId: "",
                generation: "",
                year: "",
                bodyType: "",
                engineId: "",
                engine: "",
                modificationId: "",
                modification: "",
              });
              return;
            }
            const gen = opt.meta as DbGeneration;
            onChange({
              ...value,
              generationId: gen.id,
              generation: gen.shortName || gen.name,
              year: "",
              yearSemantics: "PRODUCTION_YEAR",
              bodyType: "",
              engineId: "",
              engine: "",
              modificationId: "",
              modification: "",
            });
          }}
        />
      )}

      {/* 4–7. Year, BodyType, Engine, Modification */}
      {(value.generationId || (value.modelId && !generationsLoading && generations.length === 0)) && (
        <div className="grid gap-3.5 border-t border-[#343a3d] pt-3">
          <SearchableCombobox
            testId="vehicle-combobox-year"
            label={(() => {
              const sem = yearSemantics || value.yearSemantics;
              return sem && YEAR_SEMANTIC_LABELS[sem]
                ? YEAR_SEMANTIC_LABELS[sem]
                : "Год (по данным каталога)";
            })()}
            placeholder="Выберите или введите год…"
            options={yearOptions}
            valueId={value.year}
            displayValue={value.year}
            loading={optionsLoading}
            error={optionsError}
            emptyText="Годы не указаны"
            minSearchLength={1}
            onSelect={(opt) => {
              onChange({
                ...value,
                year: opt ? opt.id : "",
                yearSemantics: yearSemantics || value.yearSemantics || "",
              });
            }}
          />

          <SearchableCombobox
            testId="vehicle-combobox-bodyType"
            label="Кузов"
            placeholder="Выберите тип кузова…"
            options={bodyTypeOptions}
            valueId={value.bodyType}
            displayValue={BODY_TYPE_LABELS[value.bodyType as BodyType] || value.bodyType}
            loading={optionsLoading}
            emptyText="Кузова не найдены"
            minSearchLength={1}
            onSelect={(opt) => {
              onChange({ ...value, bodyType: opt ? opt.id : "" });
            }}
          />

          {value.generationId && (
            <>
              <SearchableCombobox
                testId="vehicle-combobox-engine"
                label="Двигатель"
                placeholder="Выберите или введите двигатель…"
                options={engineOptions}
                valueId={value.engineId}
                displayValue={value.engine}
                loading={optionsLoading}
                emptyText="Двигатели не найдены"
                minSearchLength={2}
                onSelect={(opt) => {
                  if (!opt) {
                    onChange({ ...value, engineId: "", engine: "", modificationId: "", modification: "" });
                    return;
                  }
                  const eng = opt.meta as DbEngine;
                  onChange({
                    ...value,
                    engineId: eng.id,
                    engine: eng.name,
                    modificationId: "",
                    modification: "",
                  });
                }}
              />

              <SearchableCombobox
                testId="vehicle-combobox-modification"
                label="Модификация"
                placeholder="Выберите модификацию…"
                options={modificationOptions}
                valueId={value.modificationId}
                displayValue={value.modification}
                loading={optionsLoading}
                emptyText="Модификации не найдены"
                minSearchLength={2}
                onSelect={(opt) => {
                  if (!opt) {
                    onChange({ ...value, modificationId: "", modification: "" });
                    return;
                  }
                  const mod = opt.meta as DbModification;
                  onChange({
                    ...value,
                    modificationId: mod.id,
                    modification: mod.name,
                  });
                }}
              />
            </>
          )}
        </div>
      )}

      <p className="text-[10px] leading-relaxed text-[#6f7477]">
        Справочник:{" "}
        <a
          href="https://vehiclesdb.com"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-[#f1f0eb]"
        >
          VehiclesDB
        </a>{" "}
        (CC BY 4.0) ·{" "}
        <a href="/about#vehicle-data" className="underline hover:text-[#f1f0eb]">
          источники
        </a>
      </p>
    </div>
  );
}
