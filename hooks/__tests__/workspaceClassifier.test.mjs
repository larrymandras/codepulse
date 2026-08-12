// D-02/D-07/D-09/D-14 pure classifier tests (115-05). No HTTP server, no mkdtempSync —
// every function under test is pure, so neither is needed here.
//
// Every negative assertion in this file has a sibling CONTROL asserting the opposite from
// a different real input, per this project's standing rule that N `false`/`null`/withheld
// results are indistinguishable from a function that always returns that value without a
// passing control alongside them.
import { describe, it, expect } from "vitest";
import {
  normalizeRel,
  isShareable,
  classifyFile,
  resolveRootDepartment,
  substituteComposeDefaults,
  resolveComposeSource,
  parseComposeVolumeEntry,
  deriveMountedPaths,
  resolveAccess,
} from "../workspaceClassifier.mjs";
import { loadWorkspaceConfig } from "../workspaceConfig.mjs";

const config = loadWorkspaceConfig();
const isSecretFor = (basename, rootId = "vault") =>
  classifyFile({ rootId, relPath: basename, basename }, config).isSecret;

// ---------------------------------------------------------------------------------------
// D-02 deny-by-default (the phase's central proof)
// ---------------------------------------------------------------------------------------

describe("D-02 deny-by-default — suite 1: the four measured leaks are withheld", () => {
  // Measured against Larry's real tree (115-CONTEXT.md D-02): the donor's enumerating
  // SECRET_RE returned PUBLIC for all four of these. Cite them by name so nobody
  // "simplifies" the case list away.
  it.each(["selfhosted.envfile", ".claude.json", ".mcp.json", "generate_admin_key.sh"])(
    "%s is withheld (isSecret: true)",
    (name) => {
      expect(isSecretFor(name)).toBe(true);
    }
  );
});

describe("D-02 deny-by-default — suite 2: CONTROL, a shareable set is shared", () => {
  // Without this suite, suite 1 is satisfied by a function that always returns true.
  it.each(["README.md", "App.tsx", "hooks.mjs", "diagram.svg", "photo.jpg", "notes.txt"])(
    "%s is shared (isSecret: false)",
    (name) => {
      expect(isSecretFor(name)).toBe(false);
    }
  );
});

describe("D-02 deny-by-default — suite 3: every deliberately-omitted extension family is withheld", () => {
  it.each([
    "tsconfig.json",
    "compose.yaml",
    "config.yml",
    "settings.toml",
    "run.sh",
    "deploy.ps1",
    "task.bat",
    "wrap.vbs",
    "dump.sql",
    "server.pem",
    "id_rsa.key",
    "export.csv",
    "app.log",
    "db.sqlite3",
    "Makefile", // extensionless
  ])("%s is withheld", (name) => {
    expect(isSecretFor(name)).toBe(true);
  });
});

describe("D-02 deny-by-default — suite 4: dotfile rule takes precedence over the extension allowlist", () => {
  it.each([".gitignore", ".npmrc", ".env.local", ".claude.json"])(
    "%s is withheld",
    (name) => {
      expect(isSecretFor(name)).toBe(true);
    }
  );

  it("a dotted-later-segment file that would otherwise look allowlisted is still withheld — ordering proof", () => {
    // .notes.md: requireNonDotBasename fires on the leading dot BEFORE the .md
    // extension is ever consulted. This is the real ambiguity D-02 must resolve one way.
    expect(isSecretFor(".notes.md")).toBe(true);
  });
});

describe("D-02 deny-by-default — suite 5: case insensitivity", () => {
  it("README.MD and Photo.JPEG are shared", () => {
    expect(isSecretFor("README.MD")).toBe(false);
    expect(isSecretFor("Photo.JPEG")).toBe(false);
  });

  it("RUN.SH is withheld", () => {
    expect(isSecretFor("RUN.SH")).toBe(true);
  });
});

describe("D-02 deny-by-default — suite 6: byRoot override REPLACES default, does not merge", () => {
  const overrideConfig = {
    ...config,
    shareableAllowlist: {
      ...config.shareableAllowlist,
      byRoot: { locked: { requireNonDotBasename: true, extensions: [] } },
    },
  };

  it("README.md under root 'locked' is withheld (empty extensions list wins over default)", () => {
    expect(
      classifyFile({ rootId: "locked", relPath: "README.md", basename: "README.md" }, overrideConfig)
        .isSecret
    ).toBe(true);
  });

  it("CONTROL — the same file under root 'vault' (no override) is still shared", () => {
    expect(
      classifyFile({ rootId: "vault", relPath: "README.md", basename: "README.md" }, overrideConfig)
        .isSecret
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------
// D-07/D-14 departments
// ---------------------------------------------------------------------------------------

describe("D-07/D-14 departments — suite 7: every declared root resolves to its declared department", () => {
  it("matches config.roots exactly, tracking the live config rather than duplicating it", () => {
    expect(config.roots.length).toBeGreaterThan(0);
    for (const root of config.roots) {
      expect(resolveRootDepartment(root.id, config)).toBe(root.department);
    }
  });
});

describe("D-07/D-14 departments — suite 8: undeclared root -> Unclassified", () => {
  it("an undeclared root id resolves to Unclassified", () => {
    expect(resolveRootDepartment("no-such-root-9x7q2", config)).toBe("Unclassified");
  });

  it("CONTROL — a declared root with a real department still returns that department", () => {
    expect(resolveRootDepartment("codepulse", config)).toBe("Personal");
  });
});

describe("D-07/D-14 departments — suite 9: out-of-vocabulary department -> Unclassified, never the literal value", () => {
  it("a root declared with an unrecognized department string never leaks through", () => {
    const synthConfig = {
      ...config,
      roots: [{ id: "weird-root", path: "/weird", department: "Engineering" }],
    };
    expect(resolveRootDepartment("weird-root", synthConfig)).toBe("Unclassified");
  });
});

// ---------------------------------------------------------------------------------------
// D-09 access
// ---------------------------------------------------------------------------------------

describe("D-09 access — suite 10: deriveMountedPaths unions ALL services, not just the first", () => {
  it("a path declared only under the second service is present in the union", () => {
    const composeFixture = {
      services: {
        alpha: { volumes: ["${A:-C:/Example/alpha-only}:/x"] },
        beta: { volumes: ["${B:-C:/Example/beta-only}:/y"] },
      },
    };
    const { mounted, ok } = deriveMountedPaths(composeFixture, {
      composeDir: "C:/Example/repo",
      homeDir: "C:/Example/home",
    });
    expect(ok).toBe(true);
    expect(mounted.has("c:/example/alpha-only")).toBe(true);
    expect(mounted.has("c:/example/beta-only")).toBe(true);
  });
});

describe("D-09 access — suite 11: a ${VAR:-default} token as a PREFIX of the source", () => {
  it("resolves to default + suffix, not the whole-string default", () => {
    const raw = "${FORGE_REPO_PATH:-C:\\Example\\forge}\\.claude\\skills";
    expect(substituteComposeDefaults(raw)).toBe("C:\\Example\\forge\\.claude\\skills");
    expect(resolveComposeSource(raw, { composeDir: "C:/Example/repo" })).toBe(
      "c:/example/forge/.claude/skills"
    );
  });
});

describe("D-09 access — suite 12: ~ expands against homeDir; ./ and ../ resolve against composeDir", () => {
  it("~/x expands against homeDir", () => {
    expect(resolveComposeSource("~/x", { homeDir: "C:/Example/home" })).toBe(
      "c:/example/home/x"
    );
  });

  it("../y resolves against composeDir", () => {
    expect(
      resolveComposeSource("../y", { composeDir: "C:/Example/repo/sub" })
    ).toBe("c:/example/repo/y");
  });

  it("./ (exactly) resolves to composeDir itself", () => {
    expect(resolveComposeSource("./", { composeDir: "C:/Example/repo" })).toBe(
      "c:/example/repo"
    );
  });
});

describe("D-09 access — suite 13: named volumes and container-internal posix paths resolve to null", () => {
  it("a named volume (no separator prefix) is null", () => {
    expect(resolveComposeSource("my-named-volume", {})).toBeNull();
  });

  it("a container-internal posix path (leading / , not drive-absolute) is null", () => {
    expect(resolveComposeSource("/var/run/docker.sock", {})).toBeNull();
  });
});

describe("D-09 access — suite 14: a ${VAR} token with no default resolves to null", () => {
  it("never guesses a value for an unresolvable token", () => {
    expect(substituteComposeDefaults("${NO_DEFAULT_HERE}/foo")).toBeNull();
    expect(resolveComposeSource("${NO_DEFAULT_HERE}/foo", {})).toBeNull();
  });
});

describe("D-09 access — suite 15: resolveAccess descendant match, sibling-prefix non-match, fail-closed", () => {
  const mounted = new Set(["c:/example/repo/codepulse"]);

  it("CONTROL — a real descendant is astridr-reachable", () => {
    expect(resolveAccess("C:/Example/repo/codepulse/src", mounted)).toBe(
      "astridr-reachable"
    );
  });

  it("a sibling-prefix directory is NOT treated as a descendant", () => {
    expect(resolveAccess("C:/Example/repo/codepulse-old", mounted)).toBe("local-only");
  });

  it("an empty or absent mounted set fails closed to local-only", () => {
    expect(resolveAccess("C:/Example/repo/codepulse", new Set())).toBe("local-only");
    expect(resolveAccess("C:/Example/repo/codepulse", null)).toBe("local-only");
  });
});

describe("D-09 access — suite 16: object-form volume entries", () => {
  it("a bind-type object entry resolves", () => {
    expect(
      parseComposeVolumeEntry(
        { type: "bind", source: "C:/Example/bind-src", target: "/x" },
        {}
      )
    ).toBe("c:/example/bind-src");
  });

  it("a volume-type object entry (not a bind mount) is null", () => {
    expect(
      parseComposeVolumeEntry({ type: "volume", source: "my-vol", target: "/x" }, {})
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------
// Path normalization
// ---------------------------------------------------------------------------------------

describe("suite 17: normalizeRel", () => {
  it("converts backslashes, collapses doubled separators, strips a trailing separator", () => {
    expect(normalizeRel("C:\\Example\\\\dir\\\\")).toBe("C:/Example/dir");
  });
});
