// Cached cv instance to ensure the WASM is initialised only once.
// `any` here keeps the loader agnostic to build signature differences (promise vs direct object).
let cachedCv: any = null;

function isPromiseInstance(obj: any): obj is Promise<any> {
  return obj instanceof Promise;
}

/**
 * Loads OpenCV.js (WASM) and returns the ready-to-use `cv` object.
 * Subsequent calls resolve immediately with the cached instance.
 */
export async function loadOpenCV(): Promise<any> {
  if (cachedCv) return cachedCv;

  const mod: any = await import('@techstark/opencv-js');
  const cvCandidate: any = mod?.default ?? mod;

  let cv: any;

  if (isPromiseInstance(cvCandidate)) {
    cv = await cvCandidate;
  } else {
    cv = cvCandidate;
    if (cv && typeof cv.onRuntimeInitialized === 'function') {
      await new Promise<void>(resolve => {
        const previous = cv.onRuntimeInitialized;
        cv.onRuntimeInitialized = () => {
          previous?.();
          resolve();
        };
      });
    }
  }

  if (cv?.setLogLevel) {
    cv.setLogLevel(cv.LOG_LEVEL_SILENT);
  }

  cachedCv = cv;

  return cachedCv;
}