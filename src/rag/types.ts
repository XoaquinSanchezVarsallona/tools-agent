export type RagSource = {
  source: string;
  section: string;
  url: string;
  content: string;
  path: string;
};

export type RagChunk = {
  id: string;
  source: string;
  section: string;
  url: string;
  content: string;
  embedding: number[];
};

export type RagIndex = {
  embeddingModel: string;
  generatedAt: string;
  chunks: RagChunk[];
};

export type RetrievedChunk = RagChunk & {
  score: number;
};
