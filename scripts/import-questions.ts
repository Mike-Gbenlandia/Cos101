import fs from "node:fs";
import path from "node:path";
import { normaliseAnswer, normaliseQuestionText } from "../lib/normalise";
import type { Confidence, Question, QuestionOption, Taxonomy } from "../lib/types";

const ROOT = process.cwd();
const RAW_DIR = path.join(ROOT, "raw-questions");
const DATA_DIR = path.join(ROOT, "data");
const QUESTIONS_DIR = path.join(DATA_DIR, "questions");
const TAXONOMY_PATH = path.join(DATA_DIR, "taxonomy.json");

interface ParsedRawItem {
  sourceFile: string;
  indexInFile: number;
  stem: string;
  options?: QuestionOption[];
  rawAnswer: string;
  answerOptionId?: string;
}

interface ClassificationResult {
  module: string;
  unit: string;
  topic: string;
  confidence: Confidence;
  reason?: string;
}

function loadTaxonomy(): Taxonomy {
  return JSON.parse(fs.readFileSync(TAXONOMY_PATH, "utf8")) as Taxonomy;
}

function parseRawTextFile(filePath: string, sourceFile: string): {
  items: ParsedRawItem[];
  flaggedParseIssues: string[];
} {
  const rawLines = fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const items: ParsedRawItem[] = [];
  const flaggedParseIssues: string[] = [];
  let buf: string[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    if (line.startsWith("Answer:")) {
      let rawAns = line.slice(7).trim();
      const hasOpts = buf.some((bl) => /^A\.\s*/.test(bl));

      if (hasOpts) {
        const mcqMatch = rawAns.match(/^([A-D])\.\s*(.*)$/);
        if (mcqMatch) {
          const letter = mcqMatch[1];
          let optText = "";
          let collecting = false;
          for (const bl of buf) {
            if (bl.startsWith(`${letter}.`)) {
              collecting = true;
              optText = bl.slice(2).trim();
            } else if (collecting) {
              if (/^[A-D]\.\s*/.test(bl)) break;
              optText += " " + bl;
            }
          }
          // Handle wrapped MCQ answers spanning into the next line
          while (i + 1 < rawLines.length) {
            const currentBody = rawAns
              .replace(/^[A-D]\.\s*/, "")
              .replace(/\s+/g, " ")
              .trim();
            const normOpt = optText.replace(/\s+/g, " ").trim();
            if (
              normOpt.length > currentBody.length &&
              normOpt.startsWith(currentBody)
            ) {
              i++;
              rawAns += " " + rawLines[i];
            } else {
              break;
            }
          }
        }
      }

      if (!rawAns) {
        flaggedParseIssues.push(
          `[${sourceFile} item #${items.length + 1}] Missing answer for: "${buf.join(" ").slice(0, 100)}"`
        );
        buf = [];
        continue;
      }

      const stemParts: string[] = [];
      const optMap = new Map<string, string>();
      let currentOptLetter: string | null = null;

      for (const bl of buf) {
        const m = hasOpts ? bl.match(/^([A-D])\.\s*(.*)$/) : null;
        if (m && (currentOptLetter !== null || m[1] === "A")) {
          currentOptLetter = m[1];
          optMap.set(currentOptLetter, m[2].trim());
        } else if (currentOptLetter) {
          optMap.set(
            currentOptLetter,
            `${optMap.get(currentOptLetter) ?? ""} ${bl}`.trim()
          );
        } else {
          stemParts.push(bl);
        }
      }

      const stem = normaliseQuestionText(stemParts.join(" "));
      let options: QuestionOption[] | undefined;
      let answerOptionId: string | undefined;

      if (hasOpts && optMap.size >= 2) {
        options = ["A", "B", "C", "D"]
          .filter((l) => optMap.has(l))
          .map((l) => ({
            id: l.toLowerCase(),
            text: (optMap.get(l) ?? "").replace(/\s+/g, " ").trim(),
          }));
        const ansLetterMatch = rawAns.match(/^([A-D])\b/);
        if (ansLetterMatch) {
          answerOptionId = ansLetterMatch[1].toLowerCase();
        } else {
          const matchedOpt = options.find(
            (o) => normaliseAnswer(o.text) === normaliseAnswer(rawAns)
          );
          answerOptionId = matchedOpt?.id;
        }
        if (!answerOptionId) {
          flaggedParseIssues.push(
            `[${sourceFile} item #${items.length + 1}] Could not map MCQ answer "${rawAns}" to options for: "${stem.slice(0, 90)}"`
          );
        }
      }

      items.push({
        sourceFile,
        indexInFile: items.length,
        stem,
        options,
        rawAnswer: rawAns.replace(/\s+/g, " ").trim(),
        answerOptionId,
      });
      buf = [];
    } else {
      buf.push(line);
    }
  }

  if (buf.length > 0) {
    flaggedParseIssues.push(
      `[${sourceFile}] Trailing unparsed lines without Answer:: ${buf.join(" | ").slice(0, 140)}`
    );
  }

  return { items, flaggedParseIssues };
}

function buildAcceptedAnswers(rawAnswer: string): string[] {
  const clean = rawAnswer.replace(/\s+/g, " ").trim();
  const variants = new Set<string>([clean]);

  // If raw answer has explicit slash alternatives in source text (e.g. "Feedback/Control")
  if (clean.includes("/") && !clean.includes("://")) {
    for (const part of clean.split("/")) {
      const trimmed = part.trim();
      if (trimmed) variants.add(trimmed);
    }
  }

  // If raw answer includes parenthetical abbreviation in source text (e.g. "Hertz (Hz)")
  const parenMatch = clean.match(/^(.+?)\s*\(([^)]+)\)$/);
  if (parenMatch) {
    const main = parenMatch[1].trim();
    const abbr = parenMatch[2].trim();
    if (main) variants.add(main);
    if (abbr) variants.add(abbr);
  }

  return Array.from(variants);
}

/**
 * Rule-based COS101 build-time classifier grounded in COS101_1793378284977_43197a1e.pdf.
 * Uses source module structure (for cos101-exam-summary.txt) plus exact content rules
 * so every single question maps deterministically to its module, unit, and topic.
 */
function classifyCos101Question(
  item: ParsedRawItem,
  taxonomy: Taxonomy
): ClassificationResult {
  const correctOptText = item.options
    ? item.options.find((o) => o.id === item.answerOptionId)?.text ?? ""
    : "";
  const fullText = `${item.stem} ${correctOptText || item.rawAnswer}`.toLowerCase();

  const idx = item.indexInFile;
  const isMainSummaryFile = item.sourceFile === "cos101-exam-summary.txt";

  // Determine Module hint from the verified 6-module structure in cos101-exam-summary.txt
  let moduleHint: string | null = null;
  if (isMainSummaryFile) {
    if (idx <= 143) moduleHint = "m1";
    else if (idx <= 275) moduleHint = "m2";
    else if (idx <= 453) moduleHint = "m3";
    else if (idx <= 583) moduleHint = "m4";
    else if (idx <= 696) moduleHint = "m5";
    else moduleHint = "m6";
  }

  // --- MODULE 1 ---
  if (
    moduleHint === "m1" ||
    (!moduleHint &&
      /\b(abacus|pre-mechanical|napier|pascaline|jacquard|differential engine|difference engine|analytical engine|lovelace|babbage|electromechanical|zuse|mark i|bell labs|stibitz|aiken|vacuum tube|transistor|integrated circuit|microprocessor|altair 8800|first generation|second generation|third generation|fourth generation|fifth generation|special-purpose|general-purpose|analog computer|digital computer|hybrid computer|digitiser|supercomputer|mainframe|big iron|minicomputer|microcomputer)\b/.test(
        fullText
      ))
  ) {
    const isU2 =
      (isMainSummaryFile && ((idx >= 43 && idx <= 78) || (idx >= 126 && idx <= 143))) ||
      (/\b(purpose|special-purpose|general-purpose|multi-tasking|analog|digital|hybrid|digitiser|continuous data|discrete|supercomputer|mainframe|big iron|minicomputer|microcomputer|size and processing power|data handled|volume of work)\b/.test(
        fullText
      ) &&
        !/\b(abacus|mechanical era|babbage|analytical|zuse|mark i|generation|vacuum|transistor)\b/.test(
          fullText
        ));

    if (isU2) {
      if (
        /\b(supercomputer|mainframe|big iron|minicomputer|microcomputer|size and processing|volume of work)\b/.test(
          fullText
        )
      ) {
        return {
          module: "m1",
          unit: "m1-u2",
          topic: "classification-by-size-power",
          confidence: "high",
        };
      }
      if (
        /\b(analog|digital|hybrid|digitiser|continuous|discrete|data handled|data they process|measure|voltage)\b/.test(
          fullText
        ) &&
        !/\b(special-purpose|general-purpose)\b/.test(fullText)
      ) {
        return {
          module: "m1",
          unit: "m1-u2",
          topic: "classification-by-data-handled",
          confidence: "high",
        };
      }
      return {
        module: "m1",
        unit: "m1-u2",
        topic: "classification-by-purpose",
        confidence: "high",
      };
    }

    if (/\b(pre-mechanical|1450 ad|abacus|beads|horizontal bar)\b/.test(fullText)) {
      return {
        module: "m1",
        unit: "m1-u1",
        topic: "pre-mechanical-era-abacus",
        confidence: "high",
      };
    }
    if (
      /\b(mechanical era|1840|napier|pascaline|pascal|1617|1642|tax collector|slide rule|rectangular rods)\b/.test(
        fullText
      )
    ) {
      return {
        module: "m1",
        unit: "m1-u1",
        topic: "mechanical-era-napier-pascaline",
        confidence: "high",
      };
    }
    if (
      /\b(jacquard|loom|1801|weaving|punched card|differential engine|difference engine|analytical engine|babbage|lovelace|finite|polynomial|store|mill|reader|operation card|variable card|number card)\b/.test(
        fullText
      )
    ) {
      return {
        module: "m1",
        unit: "m1-u1",
        topic: "jacquard-loom-babbage-engines",
        confidence: "high",
      };
    }
    if (
      /\b(electromechanical|relay|zuse|z3|2,600|mark i|howard aiken|bell labs|stibitz|eniac|transition|vacuum tubes and relays|moving parts)\b/.test(
        fullText
      ) &&
      !/\bfirst-generation|first generation\b/.test(fullText)
    ) {
      return {
        module: "m1",
        unit: "m1-u1",
        topic: "electromechanical-era-mark-i",
        confidence: "high",
      };
    }
    return {
      module: "m1",
      unit: "m1-u1",
      topic: "five-generations-of-computers",
      confidence: "high",
    };
  }

  // --- MODULE 2 ---
  if (moduleHint === "m2") {
    const isU2 =
      (isMainSummaryFile && ((idx >= 179 && idx <= 216) || (idx >= 264 && idx <= 275))) ||
      (!/\bcharacteristic\b/.test(fullText) &&
        /\b(system operation|information processing cycle|fetch|decode|execute|instruction cycle|five stages|four essential functions)\b/.test(
          fullText
        ));

    if (isU2) {
      if (
        (isMainSummaryFile && idx >= 206 && idx <= 216) ||
        (/\b(fetch|decode|execute|instruction cycle|next instruction)\b/.test(
          fullText
        ) &&
          !/\b(information processing cycle|five stages)\b/.test(fullText))
      ) {
        return {
          module: "m2",
          unit: "m2-u2",
          topic: "fetch-decode-execute-cycle",
          confidence: "high",
        };
      }
      if (
        (isMainSummaryFile && ((idx >= 192 && idx <= 205) || (idx >= 268 && idx <= 275))) ||
        /\b(information processing cycle|five stages|four essential|input stage|processing stage|output stage|storage stage|feedback|input function|processing function|storage function|output function|continuous cycle)\b/.test(
          fullText
        )
      ) {
        return {
          module: "m2",
          unit: "m2-u2",
          topic: "information-processing-cycle",
          confidence: "high",
        };
      }
      return {
        module: "m2",
        unit: "m2-u2",
        topic: "system-operation-overview",
        confidence: "high",
      };
    }

    // M2-U1
    if (
      /\b(computing science|computer science|mechanization|methodical procedures|essentially a tool|stored program|application|primary function of a computer|input data through the|screen or the|hard disk or other|abbreviated as cpu)\b/.test(
        fullText
      ) ||
      (isMainSummaryFile && (idx <= 155 || (idx >= 217 && idx <= 220)))
    ) {
      return {
        module: "m2",
        unit: "m2-u1",
        topic: "definitions-computer-computing",
        confidence: "high",
      };
    }
    if (
      /\b(computing environment|auxiliary|stabilizer|ups|air conditioner|raw facts|algorithm|human-ware|ict|smallest unit of data|bit|byte|kilobyte|megabyte|gigabyte|1024)\b/.test(
        fullText
      ) ||
      (isMainSummaryFile && ((idx >= 175 && idx <= 178) || (idx >= 230 && idx <= 245)))
    ) {
      return {
        module: "m2",
        unit: "m2-u1",
        topic: "computing-environment-data-units",
        confidence: "high",
      };
    }
    if (/\b(no intelligence|no emotion|common sense)\b/.test(fullText)) {
      return {
        module: "m2",
        unit: "m2-u1",
        topic: "computer-limitations",
        confidence: "high",
      };
    }
    if (
      /\b(speed|hertz|gigahertz|nanosecond|accuracy|gigo|cause of errors|diligence|automation|versatility|storage capacity|primary storage|secondary storage|ssd|reliability|multitasking|characteristic)\b/.test(
        fullText
      ) ||
      (isMainSummaryFile && idx >= 246 && idx <= 263)
    ) {
      return {
        module: "m2",
        unit: "m2-u1",
        topic: "computer-characteristics-capabilities",
        confidence: "high",
      };
    }
    return {
      module: "m2",
      unit: "m2-u1",
      topic: "computer-system-components",
      confidence: "high",
    };
  }

  // --- MODULE 3 ---
  if (moduleHint === "m3") {
    // M3-U1: Input devices (276..290, 365..384)
    if ((idx >= 276 && idx <= 290) || (idx >= 365 && idx <= 384)) {
      if (
        /\b(esc|ctrl|alt|del|ins|shift|caps lock|num lock|tab|backspace|return|enter|insert|delete|alternate|home|end|pgdn|pgup|cursor|extended characters)\b/.test(
          fullText
        )
      ) {
        return {
          module: "m3",
          unit: "m3-u1",
          topic: "keyboard-control-modifier-keys",
          confidence: "high",
        };
      }
      if (/\b(mouse|joystick)\b/.test(fullText)) {
        return {
          module: "m3",
          unit: "m3-u1",
          topic: "pointing-devices-mouse-joystick",
          confidence: "high",
        };
      }
      if (/\b(scanner|flatbed|handheld)\b/.test(fullText)) {
        return {
          module: "m3",
          unit: "m3-u1",
          topic: "scanners",
          confidence: "high",
        };
      }
      return {
        module: "m3",
        unit: "m3-u1",
        topic: "keyboard-key-groups",
        confidence: "high",
      };
    }

    // M3-U2: Output devices (291..305, 385..399)
    if ((idx >= 291 && idx <= 305) || (idx >= 385 && idx <= 399)) {
      if (
        /\b(monitor|visual display unit|crt|cathode ray|lcd|oled|touchscreen|display technology)\b/.test(
          fullText
        )
      ) {
        return {
          module: "m3",
          unit: "m3-u2",
          topic: "monitors-display-types",
          confidence: "high",
        };
      }
      if (/\b(speaker|sound card)\b/.test(fullText)) {
        return {
          module: "m3",
          unit: "m3-u2",
          topic: "speakers-and-sound-cards",
          confidence: "high",
        };
      }
      return {
        module: "m3",
        unit: "m3-u2",
        topic: "printers",
        confidence: "high",
      };
    }

    // M3-U3: Processing device & CPU (306..320, 400..413)
    if ((idx >= 306 && idx <= 320) || (idx >= 400 && idx <= 413)) {
      if (
        /\b(motherboard|cpu socket|memory slots|chipset|expansion slot|bios|uefi)\b/.test(
          fullText
        )
      ) {
        return {
          module: "m3",
          unit: "m3-u3",
          topic: "motherboard-architecture",
          confidence: "high",
        };
      }
      if (/\b(clock speed|hertz|word size|cores|performance)\b/.test(fullText)) {
        return {
          module: "m3",
          unit: "m3-u3",
          topic: "cpu-performance-and-importance",
          confidence: "high",
        };
      }
      if (
        /\b(alu|arithmetic logic|arithmetic and logic|control unit|cu|registers|accumulator|instruction register|program counter)\b/.test(
          fullText
        )
      ) {
        return {
          module: "m3",
          unit: "m3-u3",
          topic: "cpu-components-alu-cu-registers",
          confidence: "high",
        };
      }
      return {
        module: "m3",
        unit: "m3-u3",
        topic: "cpu-definition-and-functions",
        confidence: "high",
      };
    }

    // M3-U4: Auxiliary devices (321..334, 414..423)
    if ((idx >= 321 && idx <= 334) || (idx >= 414 && idx <= 423)) {
      if (
        /\b(heat|temperature|dust|cooling|humidity|air conditioner|overheating)\b/.test(
          fullText
        )
      ) {
        return {
          module: "m3",
          unit: "m3-u4",
          topic: "air-conditioner",
          confidence: "high",
        };
      }
      if (
        /\b(ups|temporary electrical power|stores.*energy|unsaved work|power is suddenly interrupted)\b/.test(
          fullText
        )
      ) {
        return {
          module: "m3",
          unit: "m3-u4",
          topic: "uninterruptible-power-supply",
          confidence: "high",
        };
      }
      return {
        module: "m3",
        unit: "m3-u4",
        topic: "voltage-stabilizer-and-transformer",
        confidence: "high",
      };
    }

    // M3-U5: Hardware components (335..349, 424..433)
    if ((idx >= 335 && idx <= 349) || (idx >= 424 && idx <= 433)) {
      if (/\b(8086|80286|80386|80486|pentium|generations of cpu)\b/.test(fullText)) {
        return {
          module: "m3",
          unit: "m3-u5",
          topic: "cpu-speed-and-generations",
          confidence: "high",
        };
      }
      if (
        /\b(back of the|fan at the back|generate a lot of heat|power “in”|power "in"|serial port|sound jacks|keyboard port|keyboard cable|network connector|monitor port)\b/.test(
          fullText
        )
      ) {
        return {
          module: "m3",
          unit: "m3-u5",
          topic: "system-unit-back-ports",
          confidence: "high",
        };
      }
      if (
        /\b(display adapter|ram|hard disk|power supply unit|switched off)\b/.test(
          fullText
        )
      ) {
        return {
          module: "m3",
          unit: "m3-u5",
          topic: "inside-system-unit-components",
          confidence: "high",
        };
      }
      return {
        module: "m3",
        unit: "m3-u5",
        topic: "system-unit-front-panel",
        confidence: "high",
      };
    }

    // M3-U6: System & application software (350..364, 434..453)
    if (
      /\b(batch|time-shar|real-time|real time|multiprogramming|multiprocessing|distributed)\b/.test(
        fullText
      )
    ) {
      return {
        module: "m3",
        unit: "m3-u6",
        topic: "types-of-operating-systems",
        confidence: "high",
      };
    }
    if (
      /\b(process management|memory management|memory hierarchy|cache|l1|sram|volatile|tertiary|magnetic tape|device driver|i\/o system|file management|command interpreter|shell|unix)\b/.test(
        fullText
      )
    ) {
      return {
        module: "m3",
        unit: "m3-u6",
        topic: "operating-system-components",
        confidence: "high",
      };
    }
    if (/\b(assembler|interpreter|compiler|translator)\b/.test(fullText)) {
      return {
        module: "m3",
        unit: "m3-u6",
        topic: "language-translators",
        confidence: "high",
      };
    }
    if (
      /\b(word processor|spreadsheet|desktop publishing|utility software)\b/.test(
        fullText
      ) &&
      !/\bsystem software, application software\b/.test(fullText)
    ) {
      return {
        module: "m3",
        unit: "m3-u6",
        topic: "application-and-utility-software",
        confidence: "high",
      };
    }
    return {
      module: "m3",
      unit: "m3-u6",
      topic: "software-classification-and-os",
      confidence: "high",
    };
  }

  // --- MODULE 4 ---
  if (moduleHint === "m4") {
    if ((idx >= 454 && idx <= 505) || (idx >= 526 && idx <= 545)) {
      if (
        /\b(education|student record|e-learning|online assessments|business|payroll|inventory|forecasting|health|medical|patient|hospital|public health|banking|finance|atm|credit scoring|fraud detection)\b/.test(
          fullText
        ) &&
        !/\bstudent scores\b/.test(fullText) &&
        !/\bmatric no\b/.test(fullText)
      ) {
        return {
          module: "m4",
          unit: "m4-u1",
          topic: "role-of-information-processing",
          confidence: "high",
        };
      }
      if (
        /\b(manual method|manual data|manual bookkeeping|handwritten|chalk|mechanical method|typewriter|adding machine|filing machine|routine|creative thinking|noisy|computer method|computer\/electronic|neatly corrected|three major methods)\b/.test(
          fullText
        )
      ) {
        return {
          module: "m4",
          unit: "m4-u1",
          topic: "information-processing-methods",
          confidence: "high",
        };
      }
      return {
        module: "m4",
        unit: "m4-u1",
        topic: "data-information-knowledge",
        confidence: "high",
      };
    }

    if (
      /\b(ebcdic|ascii|bcd|character code|character coding|ibm|parity|zone bits|numeric bits|uppercase a|lowercase a)\b/.test(
        fullText
      )
    ) {
      return {
        module: "m4",
        unit: "m4-u2",
        topic: "character-codes-bcd-ascii-ebcdic",
        confidence: "high",
      };
    }
    if (
      /\b(octal|hexadecimal|423₈|216|132|84h|2afh|9a2h|11110000|1010|1111|shorthand for binary)\b/.test(
        fullText
      )
    ) {
      return {
        module: "m4",
        unit: "m4-u2",
        topic: "octal-and-hexadecimal-systems",
        confidence: "high",
      };
    }
    return {
      module: "m4",
      unit: "m4-u2",
      topic: "binary-and-decimal-systems",
      confidence: "high",
    };
  }

  // --- MODULE 5 ---
  if (moduleHint === "m5") {
    if ((idx >= 638 && idx <= 651) || (idx >= 682 && idx <= 696)) {
      if (/\b(social media|timeline|feed|hashtag)\b/.test(fullText)) {
        return {
          module: "m5",
          unit: "m5-u2",
          topic: "social-media-features-platforms",
          confidence: "high",
        };
      }
      return {
        module: "m5",
        unit: "m5-u2",
        topic: "email-components-and-features",
        confidence: "high",
      };
    }

    if (
      /\b(isp|internet service provider|dial-up|dsl|fiber-optic|mobile broadband|3g|4g|5g|satellite)\b/.test(
        fullText
      )
    ) {
      return {
        module: "m5",
        unit: "m5-u1",
        topic: "isps-and-internet-terminology",
        confidence: "high",
      };
    }
    if (/\b(url|uniform resource locator|domain name|dns)\b/.test(fullText)) {
      return {
        module: "m5",
        unit: "m5-u1",
        topic: "urls-and-domain-names",
        confidence: "high",
      };
    }
    if (
      /\b(ip address|public ip|private ip|lan|nat|network address translation|dynamic ip|dhcp|static ip|voip|ipv4|ipv6|32-bit|128-bit|dual-stack|internet address)\b/.test(
        fullText
      )
    ) {
      return {
        module: "m5",
        unit: "m5-u1",
        topic: "ip-addressing-and-versions",
        confidence: "high",
      };
    }
    return {
      module: "m5",
      unit: "m5-u1",
      topic: "basic-internet-concepts",
      confidence: "high",
    };
  }

  // --- MODULE 6 ---
  if (moduleHint === "m6") {
    if (idx >= 777 && idx <= 796) {
      if (/\b(6g|5g|4g|cellular|terabit)\b/.test(fullText)) {
        return {
          module: "m6",
          unit: "m6-u2",
          topic: "next-gen-connectivity-6g",
          confidence: "high",
        };
      }
      if (
        /\b(quantum|qubit|superposition|entanglement|drug discovery)\b/.test(
          fullText
        )
      ) {
        return {
          module: "m6",
          unit: "m6-u2",
          topic: "quantum-computing",
          confidence: "high",
        };
      }
      if (
        /\b(agent|mas|multi-agent|single-agent|cooperative|competitive)\b/.test(
          fullText
        )
      ) {
        return {
          module: "m6",
          unit: "m6-u2",
          topic: "agentic-ai-and-mas",
          confidence: "high",
        };
      }
      return {
        module: "m6",
        unit: "m6-u2",
        topic: "ai-and-machine-learning",
        confidence: "high",
      };
    }

    // M6-U1
    if (
      /\b(cybersecurity|cia triad|confidentiality|integrity|availability|tampered)\b/.test(
        fullText
      ) &&
      !/\bdatabase administrator\b/.test(fullText)
    ) {
      return {
        module: "m6",
        unit: "m6-u1",
        topic: "cybersecurity",
        confidence: "high",
      };
    }
    if (
      /\b(computer engineering|computer engineers|hardware design|system integration|circuit boards|robotics|information system|systems analyst|database administrator|business goals)\b/.test(
        fullText
      )
    ) {
      return {
        module: "m6",
        unit: "m6-u1",
        topic: "computer-engineering-and-is",
        confidence: "high",
      };
    }
    if (
      (isMainSummaryFile && ((idx >= 727 && idx <= 741) || (idx >= 766 && idx <= 776))) ||
      (/\b(information technology|it is about|component of it|networking device|router|remote work|data centres|software engineering|agile|scrum|devops|git|solutions architect|front-end|back-end|design and architecture|testing and maintenance|software development)\b/.test(
        fullText
      ) &&
        !/\bmajor branches of computing\b/.test(fullText))
    ) {
      return {
        module: "m6",
        unit: "m6-u1",
        topic: "it-and-software-engineering",
        confidence: "high",
      };
    }
    if (
      /\b(job specialisation)\b/.test(fullText) &&
      !/\bmajor branches of computing\b/.test(fullText)
    ) {
      return {
        module: "m6",
        unit: "m6-u1",
        topic: "data-science-and-specialisation",
        confidence: "high",
      };
    }
    return {
      module: "m6",
      unit: "m6-u1",
      topic: "computer-science-and-languages",
      confidence: "high",
    };
  }

  // Fallback keyword overlap scorer across taxonomy topics for future external raw files
  const words = new Set(
    fullText
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
  let best: ClassificationResult | null = null;
  let bestScore = -1;

  for (const mod of taxonomy.modules) {
    for (const unit of mod.units) {
      for (const topic of unit.topics) {
        const refWords = `${topic.title} ${topic.reference}`
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, " ")
          .split(/\s+/)
          .filter((w) => w.length > 2);
        let score = 0;
        for (const rw of refWords) {
          if (words.has(rw)) score++;
        }
        if (score > bestScore) {
          bestScore = score;
          best = {
            module: mod.id,
            unit: unit.id,
            topic: topic.id,
            confidence: score >= 2 ? "high" : "low",
            reason:
              score < 2
                ? "Low keyword overlap with taxonomy; verify topic manually"
                : undefined,
          };
        }
      }
    }
  }

  return (
    best ?? {
      module: taxonomy.modules[0].id,
      unit: taxonomy.modules[0].units[0].id,
      topic: taxonomy.modules[0].units[0].topics[0].id,
      confidence: "low",
      reason: "Defaulted to first taxonomy topic; verify manually",
    }
  );
}

function main() {
  const taxonomy = loadTaxonomy();
  if (!fs.existsSync(RAW_DIR)) {
    console.error("Missing raw-questions directory:", RAW_DIR);
    process.exit(1);
  }

  const rawFiles = fs
    .readdirSync(RAW_DIR)
    .filter((f) => f.endsWith(".txt"))
    .sort();

  const allParsed: ParsedRawItem[] = [];
  const parseIssues: string[] = [];

  for (const file of rawFiles) {
    const { items, flaggedParseIssues } = parseRawTextFile(
      path.join(RAW_DIR, file),
      file
    );
    allParsed.push(...items);
    parseIssues.push(...flaggedParseIssues);
  }

  // Deduplicate exact matches (normalised question + normalised answer)
  const seenKeys = new Map<string, string>();
  const duplicatesRemoved: string[] = [];
  const reviewNeeded: string[] = [...parseIssues];
  const unitBuckets = new Map<string, Question[]>();
  const unitCounters = new Map<string, number>();

  for (const mod of taxonomy.modules) {
    for (const unit of mod.units) {
      unitBuckets.set(unit.id, []);
      unitCounters.set(unit.id, 0);
    }
  }

  for (const item of allParsed) {
    const answerTextForDedup = item.options
      ? item.options.find((o) => o.id === item.answerOptionId)?.text ??
        item.rawAnswer
      : item.rawAnswer;

    const dedupKey = `${normaliseQuestionText(
      item.stem
    ).toLowerCase()} || ${normaliseAnswer(answerTextForDedup)}`;

    if (seenKeys.has(dedupKey)) {
      duplicatesRemoved.push(
        `- Duplicate of \`${seenKeys.get(dedupKey)}\` (from \`${item.sourceFile}\` #${item.indexInFile + 1}): "${item.stem}" | Answer: \`${item.rawAnswer}\``
      );
      continue;
    }

    const cls = classifyCos101Question(item, taxonomy);
    const nextNum = (unitCounters.get(cls.unit) ?? 0) + 1;
    unitCounters.set(cls.unit, nextNum);
    const id = `${cls.unit}-q${String(nextNum).padStart(3, "0")}`;
    seenKeys.set(dedupKey, id);

    const hasBlank = item.stem.includes("____");
    const qType = hasBlank ? "gap" : "mcq";

    // Flag any source quality edge cases for human review (without altering source truth)
    let confidence: Confidence = cls.confidence;
    if (cls.confidence === "low" && cls.reason) {
      reviewNeeded.push(`- \`${id}\` (${cls.unit} / ${cls.topic}): ${cls.reason} — "${item.stem}"`);
    }
    if (!item.options && item.rawAnswer === "like") {
      confidence = "low";
      reviewNeeded.push(
        `- \`${id}\` (${cls.unit} / ${cls.topic}): Source gap answer is \`"like"\` (open phrase ending in "...and the ____."); verify acceptability — "${item.stem}"`
      );
    }

    const questionObj: Question = item.options
      ? {
          id,
          module: cls.module,
          unit: cls.unit,
          topic: cls.topic,
          confidence,
          type: qType,
          question: item.stem,
          options: item.options,
          answer: item.answerOptionId ?? "a",
        }
      : {
          id,
          module: cls.module,
          unit: cls.unit,
          topic: cls.topic,
          confidence,
          type: "gap",
          question: item.stem,
          acceptedAnswers: buildAcceptedAnswers(item.rawAnswer),
        };

    const bucket = unitBuckets.get(cls.unit);
    if (bucket) bucket.push(questionObj);
  }

  fs.mkdirSync(QUESTIONS_DIR, { recursive: true });
  for (const [unitId, list] of unitBuckets.entries()) {
    fs.writeFileSync(
      path.join(QUESTIONS_DIR, `${unitId}.json`),
      JSON.stringify(list, null, 2) + "\n",
      "utf8"
    );
  }

  const dupDoc = [
    "# Duplicates Removed During Import",
    "",
    `Total raw items scanned: ${allParsed.length}`,
    `Total duplicates removed: ${duplicatesRemoved.length}`,
    "",
    duplicatesRemoved.length > 0
      ? duplicatesRemoved.join("\n")
      : "No exact duplicate questions were found in the imported raw files.",
    "",
  ].join("\n");
  fs.writeFileSync(
    path.join(DATA_DIR, "duplicates-removed.md"),
    dupDoc,
    "utf8"
  );

  const reviewDoc = [
    "# Questions Flagged for Review",
    "",
    `Total flagged items: ${reviewNeeded.length}`,
    "",
    reviewNeeded.length > 0
      ? reviewNeeded.join("\n")
      : "No low-confidence classifications or missing-answer items were detected.",
    "",
  ].join("\n");
  fs.writeFileSync(path.join(DATA_DIR, "review-needed.md"), reviewDoc, "utf8");

  const importedTotal = Array.from(unitBuckets.values()).reduce(
    (sum, arr) => sum + arr.length,
    0
  );
  console.log(
    `Imported ${importedTotal} questions across ${unitBuckets.size} units (${duplicatesRemoved.length} duplicates removed, ${reviewNeeded.length} flagged for review).`
  );
}

main();
