const addURLParams = (url = "", paramsObject) => {
  const [baseURL, searchParams = ""] = url.split("?");
  const searchParamsObject = searchParams.split("&").reduce((all, keyValue) => {
    const [key, value] = keyValue.split("=");
    if (key) {
      all[key] = value;
    }
    return all;
  }, {});
  console.log({ searchParamsObject });
  const newParams = {
    ...searchParamsObject,
    ...paramsObject,
  };
  const newParamsString = Object.entries(newParams)
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  return baseURL + "?" + newParamsString;
};

const removeURLParams = (url = "") => {
  const segments = url.split("/");
  const lastSegment = segments.pop();
  const [nonSearchSegment] = lastSegment.split("?");

  segments.push(nonSearchSegment);
  return segments.join("/");
};

const paramsToObject = (paramsString = "") => {
  const searchParamsObj = paramsString.split("&").reduce((obj, param) => {
    const [key, value] = param.split("=");

    if (key && value) {
      obj[key] = value;
    }

    return obj;
  }, {});

  return searchParamsObj;
};

const toSearchParams = (paramsObject = {}) => {
  const entries = Object.entries({
    ...paramsObject,
  });

  return entries.length
    ? "?" +
        entries
          .filter(([key]) => key)
          .map((entry) => entry.join("="))
          .join("&")
    : "";
};

module.exports = {
  addURLParams,
  removeURLParams,
  paramsToObject,
  toSearchParams,
};
