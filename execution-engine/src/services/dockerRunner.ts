import { spawn, execSync } from "child_process";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { enqueue } from "./executionQueue";

export interface ExecutionResult {
  status:
    | "accepted"
    | "wrong_answer"
    | "runtime_error"
    | "time_limit_exceeded"
    | "internal_error";
  stdout: string;
  stderr: string;
  executionTime: number;
}

const MAX_OUTPUT = 1024 * 1024; // 1MB
const TIME_LIMIT = 5000; // 5 seconds

/* =============================== */
/* Check available runtimes        */
/* =============================== */

let dockerAvailable = false;
let gppAvailable = false;
let python3Available = false;

try {
  execSync("docker info", { stdio: "ignore", timeout: 3000 });
  dockerAvailable = true;
  console.log("✅ Docker available — using containerized execution");
} catch {
  dockerAvailable = false;
  console.log("⚠️  Docker not available — using direct execution (Render mode)");
}

try {
  execSync("g++ --version", { stdio: "ignore", timeout: 3000 });
  gppAvailable = true;
  console.log("✅ g++ available");
} catch {
  console.log("⚠️  g++ not found — C++ submissions will fail");
}

try {
  execSync("python3 --version", { stdio: "ignore", timeout: 3000 });
  python3Available = true;
  console.log("✅ python3 available");
} catch {
  console.log("⚠️  python3 not found — Python submissions will fail");
}

/* =============================== */
/* DIRECT (non-Docker) RUNNER      */
/* =============================== */

const runDirect = (
  language: string,
  code: string,
  input: string,
  jobDir: string
): Promise<ExecutionResult> => {
  return new Promise((resolve) => {
    // Guard: check if required runtime exists
    if (language === "cpp" && !gppAvailable) {
      resolve({
        status: "internal_error",
        stdout: "",
        stderr: "g++ compiler not available on this server. Please contact the admin.",
        executionTime: 0,
      });
      return;
    }

    if (language === "python" && !python3Available) {
      resolve({
        status: "internal_error",
        stdout: "",
        stderr: "python3 not available on this server. Please contact the admin.",
        executionTime: 0,
      });
      return;
    }

    let filename = "";
    let command: string[] = [];

    if (language === "javascript") {
      filename = "code.js";
      command = ["node", path.join(jobDir, filename)];
    } else if (language === "python") {
      filename = "code.py";
      command = ["python3", path.join(jobDir, filename)];
    } else if (language === "cpp") {
      filename = "code.cpp";
      const outFile = path.join(jobDir, "main");
      const filePath = path.join(jobDir, filename);
      fs.writeFileSync(filePath, code);

      // Compile step
      try {
        execSync(`g++ -O2 -std=c++17 "${filePath}" -o "${outFile}"`, {
          timeout: 10000,
          stdio: "pipe",
        });
      } catch (err: any) {
        resolve({
          status: "runtime_error",
          stdout: "",
          stderr: err.stderr?.toString().trim() || "Compilation failed",
          executionTime: 0,
        });
        return;
      }

      command = [outFile];
    } else {
      resolve({
        status: "internal_error",
        stdout: "",
        stderr: "Unsupported language",
        executionTime: 0,
      });
      return;
    }

    if (language !== "cpp") {
      const filePath = path.join(jobDir, filename);
      fs.writeFileSync(filePath, code);
    }

    const startTime = Date.now();
    const child = spawn(command[0], command.slice(1));

    let stdout = "";
    let stderr = "";
    let resolved = false;

    const resolveOnce = (result: ExecutionResult) => {
      if (!resolved) {
        resolved = true;
        resolve(result);
      }
    };

    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      resolveOnce({
        status: "time_limit_exceeded",
        stdout: "",
        stderr: "Execution timed out",
        executionTime: Date.now() - startTime,
      });
    }, TIME_LIMIT);

    if (input) {
      child.stdin.write(input.endsWith("\n") ? input : input + "\n");
    }
    child.stdin.end();

    child.stdout.on("data", (data) => {
      stdout += data.toString();
      if (stdout.length > MAX_OUTPUT) {
        stdout = stdout.slice(0, MAX_OUTPUT);
        child.kill("SIGKILL");
      }
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      clearTimeout(timeout);
      stdout = stdout.replace(/\r\n/g, "\n").trim();
      stderr = stderr.replace(/\r\n/g, "\n").trim();

      if (code !== 0 && stderr.length > 0) {
        resolveOnce({
          status: "runtime_error",
          stdout,
          stderr,
          executionTime: Date.now() - startTime,
        });
      } else {
        resolveOnce({
          status: "accepted",
          stdout,
          stderr,
          executionTime: Date.now() - startTime,
        });
      }
    });

    child.on("error", (err) => {
      clearTimeout(timeout);
      resolveOnce({
        status: "internal_error",
        stdout: "",
        stderr: err.message || "Execution failed",
        executionTime: Date.now() - startTime,
      });
    });
  });
};

/* =============================== */
/* DOCKER RUNNER                   */
/* =============================== */

const runDocker = (
  language: string,
  code: string,
  input: string,
  jobDir: string
): Promise<ExecutionResult> => {
  return new Promise((resolveOuter) => {
    const resolveOnce = (result: ExecutionResult) => resolveOuter(result);

    let filename = "";
    let compileImage = "";
    let runImage = "";

    if (language === "javascript") {
      filename = "code.js";
      runImage = "node:20-alpine";
    } else if (language === "python") {
      filename = "code.py";
      runImage = "python:3.11-alpine";
    } else if (language === "cpp") {
      filename = "code.cpp";
      compileImage = "gcc:13";
      runImage = "gcc:13";
    } else {
      resolveOnce({ status: "internal_error", stdout: "", stderr: "Unsupported language", executionTime: 0 });
      return;
    }

    const filePath = path.join(jobDir, filename);
    fs.writeFileSync(filePath, code);

    const compileCpp = (): Promise<boolean> => {
      return new Promise((resolveCompile) => {
        const compile = spawn("docker", [
          "run", "--rm",
          "-v", `${jobDir.replace(/\\/g, "/")}:/app`,
          "-w", "/app",
          compileImage,
          "g++", filename, "-O2", "-std=c++17", "-o", "main",
        ]);

        let compileError = "";
        compile.stderr.on("data", (d) => { compileError += d.toString(); });
        compile.on("close", (code) => {
          if (code !== 0) {
            resolveOnce({ status: "runtime_error", stdout: "", stderr: compileError.trim() || "Compilation failed", executionTime: 0 });
            resolveCompile(false);
          } else {
            resolveCompile(true);
          }
        });
        compile.on("error", () => {
          resolveOnce({ status: "internal_error", stdout: "", stderr: "Compiler execution failed", executionTime: 0 });
          resolveCompile(false);
        });
      });
    };

    const runProgram = (command: string[]) => {
      const child = spawn("docker", [
        "run", "--rm",
        "--memory=128m", "--cpus=0.5", "--pids-limit=64", "--network=none",
        "-i",
        "-v", `${jobDir.replace(/\\/g, "/")}:/app`,
        "-w", "/app",
        runImage,
        ...command,
      ]);

      let stdout = "", stderr = "";
      let resolved = false;
      const startTime = Date.now();

      const innerResolve = (result: ExecutionResult) => {
        if (!resolved) { resolved = true; resolveOnce(result); }
      };

      const timeout = setTimeout(() => {
        child.kill("SIGKILL");
        innerResolve({ status: "time_limit_exceeded", stdout: "", stderr: "Execution timed out", executionTime: Date.now() - startTime });
      }, TIME_LIMIT);

      if (input) child.stdin.write(input.endsWith("\n") ? input : input + "\n");
      child.stdin.end();

      child.stdout.on("data", (d) => { stdout += d.toString(); if (stdout.length > MAX_OUTPUT) { stdout = stdout.slice(0, MAX_OUTPUT); child.kill("SIGKILL"); } });
      child.stderr.on("data", (d) => { stderr += d.toString(); });

      child.on("close", (code) => {
        clearTimeout(timeout);
        stdout = stdout.replace(/\r\n/g, "\n").trim();
        stderr = stderr.replace(/\r\n/g, "\n").trim();
        innerResolve(code !== 0 && stderr.length > 0
          ? { status: "runtime_error", stdout, stderr, executionTime: Date.now() - startTime }
          : { status: "accepted", stdout, stderr, executionTime: Date.now() - startTime });
      });

      child.on("error", () => {
        clearTimeout(timeout);
        innerResolve({ status: "internal_error", stdout: "", stderr: "Execution failed", executionTime: Date.now() - startTime });
      });
    };

    (async () => {
      if (language === "cpp") {
        const compiled = await compileCpp();
        if (!compiled) return;
        runProgram(["./main"]);
      } else {
        runProgram(language === "javascript" ? ["node", filename] : ["python3", filename]);
      }
    })();
  });
};

/* =============================== */
/* PUBLIC API                      */
/* =============================== */

export const runCode = (
  language: string,
  code: string,
  input: string
): Promise<ExecutionResult> => {
  return new Promise((resolveOuter) => {
    enqueue(async () => {
      const jobId = uuidv4();
      const jobDir = path.join(__dirname, "..", "..", "jobs", jobId);
      fs.mkdirSync(jobDir, { recursive: true });

      const cleanup = () => {
        try { fs.rmSync(jobDir, { recursive: true, force: true }); } catch {}
      };

      let result: ExecutionResult;

      try {
        if (dockerAvailable) {
          result = await runDocker(language, code, input, jobDir);
        } else {
          result = await runDirect(language, code, input, jobDir);
        }
      } catch (err: any) {
        result = {
          status: "internal_error",
          stdout: "",
          stderr: err?.message || "Unknown error",
          executionTime: 0,
        };
      }

      cleanup();
      resolveOuter(result);
    });
  });
};
