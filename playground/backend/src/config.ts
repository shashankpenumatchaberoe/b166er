export const config = {
  port: process.env.PORT ? +process.env.PORT : 3001,
  maxAgents: process.env.MAX_AGENTS ? +process.env.MAX_AGENTS : 5,
  dataDir: process.env.DATA_DIR ?? './data',
};
