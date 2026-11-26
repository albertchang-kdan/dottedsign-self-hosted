// NOTE: request bodies that contain files (e.g. a signing recording) are sent as multipart
// instead of base64 text in JSON - smaller uploads and no extra copies in memory.

const isFile = (value) => typeof Blob !== "undefined" && value instanceof Blob;

export const hasFileValue = (data) =>
  Object.values(data || {}).some((value) => isFile(value));

// NOTE: Rails-style multipart fields: nested objects as key[sub], arrays as key[]
export const toFormData = (data, formData = new FormData(), prefix = "") => {
  Object.entries(data).forEach(([key, value]) => {
    const field = prefix ? `${prefix}[${key}]` : key;
    if (value === undefined || value === null) {
      return;
    }
    if (isFile(value)) {
      formData.append(field, value, value.name || key);
    } else if (Array.isArray(value)) {
      value.forEach((item) => formData.append(`${field}[]`, item));
    } else if (typeof value === "object") {
      toFormData(value, formData, field);
    } else {
      formData.append(field, value);
    }
  });
  return formData;
};
