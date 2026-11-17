import taxonomyData from "@/data/taxonomy.json";
import type {
  Taxonomy,
  TaxonomyModule,
  TaxonomyTopic,
  TaxonomyUnit,
} from "./types";

export const taxonomy: Taxonomy = taxonomyData as Taxonomy;

export interface TaxonomyLookups {
  moduleById: Map<string, TaxonomyModule>;
  unitById: Map<string, { unit: TaxonomyUnit; module: TaxonomyModule }>;
  topicById: Map<
    string,
    { topic: TaxonomyTopic; unit: TaxonomyUnit; module: TaxonomyModule }
  >;
  allUnits: TaxonomyUnit[];
  allTopics: TaxonomyTopic[];
}

export function buildTaxonomyLookups(tax: Taxonomy = taxonomy): TaxonomyLookups {
  const moduleById = new Map<string, TaxonomyModule>();
  const unitById = new Map<
    string,
    { unit: TaxonomyUnit; module: TaxonomyModule }
  >();
  const topicById = new Map<
    string,
    { topic: TaxonomyTopic; unit: TaxonomyUnit; module: TaxonomyModule }
  >();
  const allUnits: TaxonomyUnit[] = [];
  const allTopics: TaxonomyTopic[] = [];

  for (const mod of tax.modules) {
    moduleById.set(mod.id, mod);
    for (const unit of mod.units) {
      unitById.set(unit.id, { unit, module: mod });
      allUnits.push(unit);
      for (const topic of unit.topics) {
        topicById.set(topic.id, { topic, unit, module: mod });
        allTopics.push(topic);
      }
    }
  }

  return { moduleById, unitById, topicById, allUnits, allTopics };
}

export const taxonomyLookups = buildTaxonomyLookups(taxonomy);
