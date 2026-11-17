import m1u1 from "@/data/questions/m1-u1.json";
import m1u2 from "@/data/questions/m1-u2.json";
import m2u1 from "@/data/questions/m2-u1.json";
import m2u2 from "@/data/questions/m2-u2.json";
import m3u1 from "@/data/questions/m3-u1.json";
import m3u2 from "@/data/questions/m3-u2.json";
import m3u3 from "@/data/questions/m3-u3.json";
import m3u4 from "@/data/questions/m3-u4.json";
import m3u5 from "@/data/questions/m3-u5.json";
import m3u6 from "@/data/questions/m3-u6.json";
import m4u1 from "@/data/questions/m4-u1.json";
import m4u2 from "@/data/questions/m4-u2.json";
import m5u1 from "@/data/questions/m5-u1.json";
import m5u2 from "@/data/questions/m5-u2.json";
import m6u1 from "@/data/questions/m6-u1.json";
import m6u2 from "@/data/questions/m6-u2.json";
import type { Question } from "./types";

export const allQuestions: Question[] = [
  ...(m1u1 as Question[]),
  ...(m1u2 as Question[]),
  ...(m2u1 as Question[]),
  ...(m2u2 as Question[]),
  ...(m3u1 as Question[]),
  ...(m3u2 as Question[]),
  ...(m3u3 as Question[]),
  ...(m3u4 as Question[]),
  ...(m3u5 as Question[]),
  ...(m3u6 as Question[]),
  ...(m4u1 as Question[]),
  ...(m4u2 as Question[]),
  ...(m5u1 as Question[]),
  ...(m5u2 as Question[]),
  ...(m6u1 as Question[]),
  ...(m6u2 as Question[]),
];

export const questionsById: Map<string, Question> = new Map(
  allQuestions.map((q) => [q.id, q])
);
