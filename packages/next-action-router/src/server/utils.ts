import { colors } from "consola/utils";

export const getActionTraceString = (path: string, context: object) => `
${colors.bgBlue(" ActionPath ")}: ${path}\n
${colors.bgBlue(" Context ")}: ${context}
`;
