import * as cheerio from "cheerio";

export interface WebSearchResultItem {
    title: string;
    url: string;
    snippet: string;
}

export interface WebSearchOutput {
    query: string;
    results: WebSearchResultItem[];
}

/**
 * Búsqueda web sin API key, usando la versión "lite" de DuckDuckGo (HTML plano,
 * pensado para scraping simple). Es la opción elegida porque no requiere
 * cuenta, tarjeta ni key, a diferencia de Bing/Google/Tavily.
 *
 * Si en el futuro el grupo consigue una key gratuita de un proveedor con API
 * más estable (ej: Tavily free tier), esta función se puede reemplazar sin
 * tocar el resto del sistema, ya que la interfaz (query -> results[]) no cambia.
 */
export async function webSearchTool(args: {
    query: string;
    maxResults?: number;
}): Promise<WebSearchOutput> {
    const maxResults = args.maxResults ?? 5;
    const url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(args.query)}`;

    const response = await fetch(url, {
        headers: {
            "User-Agent": "Mozilla/5.0 (compatible; tools-agent-researcher/1.0)"
        }
    });

    if (!response.ok) {
        throw new Error(`Búsqueda web falló con status ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const results: WebSearchResultItem[] = [];

    $("a.result-link").each((_, el) => {
        if (results.length >= maxResults) return;

        const title = $(el).text().trim();
        const href = $(el).attr("href") ?? "";
        const snippet = $(el).closest("tr").next("tr").find(".result-snippet").text().trim();

        if (title && href) {
            results.push({ title, url: href, snippet });
        }
    });

    return { query: args.query, results };
}