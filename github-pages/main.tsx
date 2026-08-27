import { createRoot } from "react-dom/client";
import { LexiInterface } from "@/components/lexi/LexiInterface";
import "@/app/globals.css";

const root = document.getElementById("lexi-root");

if (!root) {
  throw new Error("Lexi's GitHub Pages root was not found.");
}

createRoot(root).render(<LexiInterface />);
