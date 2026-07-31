import { normalizeText } from "@/modules/search/tokenize";
import type {
  MemoryResponse,
  SessionMemorySnapshot,
  SessionPreference,
} from "./types";

function cleanCapturedValue(value: string): string {
  return value
    .trim()
    .replace(/[.!?]+$/, "")
    .replace(/\s+/g, " ");
}

function memoryResponse(
  text: string,
  intent: string,
  field: string,
): MemoryResponse {
  return {
    text,
    intent,
    field,
    evidence: [`session:${field}`],
    structureId: `dv7-memory:${intent}`,
  };
}

export class LexiSessionMemory {
  private userName?: string;
  private userAge?: number;
  private userLocation?: string;
  private preferences: SessionPreference[] = [];
  private activeSubjectIds: string[] = [];
  private previousQuestion?: string;
  private previousAnswer?: string;

  snapshot(): SessionMemorySnapshot {
    return {
      userName: this.userName,
      userAge: this.userAge,
      userLocation: this.userLocation,
      preferences: this.preferences.map((preference) => ({ ...preference })),
      activeSubjectIds: [...this.activeSubjectIds],
      previousQuestion: this.previousQuestion,
      previousAnswer: this.previousAnswer,
    };
  }

  setActiveSubjects(subjectIds: readonly string[]) {
    const unique = [...new Set(subjectIds)].slice(0, 2);
    if (unique.length > 0) this.activeSubjectIds = unique;
  }

  recordTurn(question: string, answer: string) {
    this.previousQuestion = question;
    this.previousAnswer = answer;
  }

  private rememberPreference(preference: SessionPreference) {
    const normalized = normalizeText(preference.value);
    this.preferences = [
      ...this.preferences.filter(
        (candidate) =>
          normalizeText(candidate.value) !== normalized ||
          candidate.polarity !== preference.polarity,
      ),
      preference,
    ].slice(-20);
  }

  interpret(input: string): MemoryResponse | undefined {
    const normalized = normalizeText(input);

    if (/^(?:forget everything|clear (?:my |the )?memory|reset (?:our )?conversation)$/.test(normalized)) {
      this.userName = undefined;
      this.userAge = undefined;
      this.userLocation = undefined;
      this.preferences = [];
      this.activeSubjectIds = [];
      this.previousQuestion = undefined;
      this.previousAnswer = undefined;
      return memoryResponse(
        "I cleared the information stored in this conversation session.",
        "memory-clear",
        "all",
      );
    }

    if (/^forget my name$/.test(normalized)) {
      this.userName = undefined;
      return memoryResponse("I removed your name from this session.", "memory-forget", "user_name");
    }

    const originalName = input.match(
      /\b(?:my name is|call me|i am called|i go by)\s+([A-Za-z][A-Za-z' -]{0,39})[.!?]*$/i,
    )?.[1];
    if (originalName) {
      this.userName = cleanCapturedValue(originalName)
        .split(" ")
        .map((part) => part ? part[0].toLocaleUpperCase("en-US") + part.slice(1) : part)
        .join(" ");
      return memoryResponse(
        `I’ll remember that your name is ${this.userName} for this conversation session.`,
        "memory-store",
        "user_name",
      );
    }

    const age = normalized.match(
      /^(?:i am|i'm|my age is)\s+(\d{1,3})(?:\s+years? old)?$/,
    )?.[1];
    if (age) {
      const parsed = Number(age);
      if (parsed >= 0 && parsed <= 130) {
        this.userAge = parsed;
        return memoryResponse(
          `I’ll remember that you are ${parsed} years old for this conversation session.`,
          "memory-store",
          "user_age",
        );
      }
    }

    const location = input.match(
      /\b(?:i live in|i am from|my location is)\s+([^.!?]{1,80})[.!?]*$/i,
    )?.[1];
    if (location) {
      this.userLocation = cleanCapturedValue(location);
      return memoryResponse(
        `I’ll remember that your location is ${this.userLocation} for this conversation session.`,
        "memory-store",
        "user_location",
      );
    }

    const preferencePatterns: Array<{
      pattern: RegExp;
      polarity: SessionPreference["polarity"];
    }> = [
      { pattern: /^(?:i like|i enjoy|my favorite is)\s+(.+)$/, polarity: "like" },
      { pattern: /^(?:i dislike|i do not like|i don't like)\s+(.+)$/, polarity: "dislike" },
      { pattern: /^i prefer\s+(.+)$/, polarity: "prefer" },
    ];
    for (const candidate of preferencePatterns) {
      const match = normalized.match(candidate.pattern)?.[1];
      if (!match) continue;
      const value = cleanCapturedValue(match);
      this.rememberPreference({ value, polarity: candidate.polarity });
      return memoryResponse(
        `I’ll remember that you ${candidate.polarity} ${value} for this conversation session.`,
        "memory-store",
        "user_preference",
      );
    }

    if (/^(?:what is|what's|do you know) my name$/.test(normalized)) {
      return this.userName
        ? memoryResponse(`Your name is ${this.userName}.`, "memory-recall", "user_name")
        : memoryResponse(
            "I don’t know your name yet. You can tell me by saying “My name is …”.",
            "memory-missing",
            "user_name",
          );
    }

    if (/^(?:how old am i|what is my age|what's my age)$/.test(normalized)) {
      return this.userAge !== undefined
        ? memoryResponse(`You told me that you are ${this.userAge} years old.`, "memory-recall", "user_age")
        : memoryResponse(
            "I don’t know your age yet. You can state it directly if you want it remembered in this session.",
            "memory-missing",
            "user_age",
          );
    }

    if (
      /^(?:where do i live|where am i from|what is my location|what's my location)$/.test(
        normalized,
      )
    ) {
      return this.userLocation
        ? memoryResponse(`You told me that your location is ${this.userLocation}.`, "memory-recall", "user_location")
        : memoryResponse(
            "I don’t know your location yet.",
            "memory-missing",
            "user_location",
          );
    }

    if (/^(?:what do i like|what are my preferences|what do i prefer)$/.test(normalized)) {
      if (this.preferences.length === 0) {
        return memoryResponse(
          "You haven’t given me a preference in this session yet.",
          "memory-missing",
          "user_preference",
        );
      }
      const summary = this.preferences
        .map((preference) => `${preference.polarity} ${preference.value}`)
        .join("; ");
      return memoryResponse(
        `You told me that you ${summary}.`,
        "memory-recall",
        "user_preference",
      );
    }

    if (
      /^(?:what did i (?:just )?ask|what was my previous question|repeat my last question)$/.test(
        normalized,
      )
    ) {
      return this.previousQuestion
        ? memoryResponse(
            `Your previous question was: “${this.previousQuestion}”`,
            "memory-recall",
            "previous_question",
          )
        : memoryResponse(
            "There is no earlier question in this conversation session.",
            "memory-missing",
            "previous_question",
          );
    }

    if (
      /^(?:what did you (?:just )?say|repeat your last answer|what was your previous answer)$/.test(
        normalized,
      )
    ) {
      return this.previousAnswer
        ? memoryResponse(
            `My previous answer was: “${this.previousAnswer}”`,
            "memory-recall",
            "previous_answer",
          )
        : memoryResponse(
            "There is no earlier answer in this conversation session.",
            "memory-missing",
            "previous_answer",
          );
    }

    if (/^(?:do you remember me|what do you remember about me)$/.test(normalized)) {
      const details = [
        this.userName ? `your name is ${this.userName}` : undefined,
        this.userAge !== undefined ? `you are ${this.userAge} years old` : undefined,
        this.userLocation ? `your location is ${this.userLocation}` : undefined,
        this.preferences.length
          ? `you gave ${this.preferences.length} preference${this.preferences.length === 1 ? "" : "s"}`
          : undefined,
      ].filter(Boolean);
      return memoryResponse(
        details.length
          ? `Within this session, I remember that ${details.join(", ")}.`
          : "I don’t have any personal details recorded in this conversation session yet.",
        "memory-summary",
        "all",
      );
    }

    return undefined;
  }
}
