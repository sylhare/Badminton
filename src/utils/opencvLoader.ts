let cachedCv: any = null;
let inFlight: Promise<any> | null = null;

function isPromiseInstance(obj: any): obj is Promise<any> {
  return obj instanceof Promise;
}

async function importOpenCV(): Promise<any> {
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

export async function loadOpenCV(): Promise<any> {
  if (cachedCv) return cachedCv;
  if (inFlight) return inFlight;

  inFlight = importOpenCV();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}