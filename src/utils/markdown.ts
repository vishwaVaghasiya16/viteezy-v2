import MarkdownIt from "markdown-it";

/**
 * MarkdownIt instance with default options
 * Supports common markdown features like:
 * - Headers, lists, links, images
 * - Code blocks, inline code
 * - Bold, italic, strikethrough
 * - Tables, blockquotes
 */
const md = new MarkdownIt({
  html: true, // Enable HTML tags in source
  breaks: true, // Convert '\n' in paragraphs into <br>
  linkify: true, // Autoconvert URL-like text to links
  typographer: true, // Enable some language-neutral replacement + quotes beautification
});

/**
 * Convert markdown text to HTML
 * @param markdown - Markdown string to convert
 * @returns HTML string
 */
export const markdownToHtml = (markdown: string | null | undefined): string => {
  if (!markdown || typeof markdown !== "string") {
    return "";
  }

  try {
    return md.render(markdown);
  } catch (error) {
    console.error("Error converting markdown to HTML:", error);
    return markdown; // Return original if conversion fails
  }
};

/**
 * Convert markdown object (i18n) to HTML object
 * @param markdownObj - Object with language keys containing markdown strings
 * @returns Object with language keys containing HTML strings
 */
export const markdownI18nToHtml = (
  markdownObj: Record<string, string | null | undefined> | null | undefined
): Record<string, string> => {
  if (!markdownObj || typeof markdownObj !== "object") {
    return {};
  }

  const htmlObj: Record<string, string> = {};

  for (const [lang, markdown] of Object.entries(
    markdownObj as Record<string, string | null | undefined>
  )) {
    if (markdown) {
      htmlObj[lang] = markdownToHtml(markdown);
    } else {
      htmlObj[lang] = "";
    }
  }

  return htmlObj;
};

export default md;
