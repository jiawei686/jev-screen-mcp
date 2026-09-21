import { isMockActive } from "./jev.js";

export async function runDoctor(json: boolean): Promise<void> {
  const hasKey = Boolean(process.env.TYPESAFE_API_KEY);
  const mock = isMockActive();
  const diag = {
    ok: true,
    mock_mode: mock,
    typesafe_api_key_present: hasKey,
    model: process.env.JEV_MODEL ?? "jev-latest",
    base_url: process.env.JEV_BASE_URL ?? "https://api.typesafe.ai/v1/systemone",
    note: mock
      ? "Mock mode: no live Jev calls. Set TYPESAFE_API_KEY to use the real API."
      : "Live mode: will call TypeSafe Jev.",
  };

  if (json) {
    console.log(JSON.stringify(diag, null, 2));
  } else {
    console.error("jev-review-mcp diagnostics");
    console.error(`  mock_mode:               ${diag.mock_mode}`);
    console.error(`  typesafe_api_key_present: ${diag.typesafe_api_key_present}`);
    console.error(`  model:                  ${diag.model}`);
    console.error(`  base_url:               ${diag.base_url}`);
    console.error(`  ${diag.note}`);
  }
  process.exit(0);
}
