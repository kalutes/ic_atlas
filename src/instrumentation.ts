export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getStore } = await import("./lib/db");
    getStore();
  }
}
