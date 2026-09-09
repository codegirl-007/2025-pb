import { describe, expect, it } from "vitest";
import { allowedHostnames, loadConfig, PRODUCTION_ORIGIN } from "../src/server/config";

describe("config", () => {
  it("defaults local development to port 8790", () => {
    const config = loadConfig({ NODE_ENV: "development" });
    expect(config.host).toBe("127.0.0.1");
    expect(config.port).toBe(8790);
    expect(config.publicUrl).toBe("http://127.0.0.1:8790");
  });

  it("lets PORT override the default", () => {
    expect(loadConfig({ NODE_ENV: "development", PORT: "9000" }).port).toBe(9000);
  });

  it("uses the birthday domain in production", () => {
    const config = loadConfig({ NODE_ENV: "production" });
    expect(config.host).toBe("0.0.0.0");
    expect(config.publicUrl).toBe(PRODUCTION_ORIGIN);
    expect(config.allowedHosts).toEqual(
      expect.arrayContaining([
        "www.theprimeagenbirthday.com",
        "theprimeagenbirthday.com",
        "theprimeagen-mcp-2hz75.ondigitalocean.app",
        "127.0.0.1",
      ]),
    );
  });

  it("allows extra hosts from ALLOWED_HOSTS", () => {
    const config = loadConfig({
      NODE_ENV: "production",
      ALLOWED_HOSTS: "example.com, another.app",
    });
    expect(config.allowedHosts).toEqual(expect.arrayContaining(["example.com", "another.app"]));
  });

  it("allows www and apex for a public URL", () => {
    expect(allowedHostnames("https://www.theprimeagenbirthday.com")).toEqual(
      expect.arrayContaining(["www.theprimeagenbirthday.com", "theprimeagenbirthday.com"]),
    );
  });
});
