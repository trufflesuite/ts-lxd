import axios, { AxiosRequestConfig, AxiosResponse } from "axios";
import { Agent } from "https";
import debugLib from "debug";
import { IASyncResponseBody, IOperationMetadata, ISyncResponseBody, IErrorResponseBody } from "../model";
import OperationError from "../OperationError";

const debug = debugLib("ts-lxd:request");

export interface IRequestOptions<RequestBodyType> {
  baseRequestUrl: string;
  path: string;
  body?: RequestBodyType;
  waitForOperationCompletion?: boolean;
  agent?: Agent;
}

/**
 * Performs a REST request on this client.
 * @param options
 */
export async function request<RequestBodyType, T>(options: IRequestOptions<RequestBodyType>): Promise<T | IOperationMetadata<T>> {
  // parse path, strip leading slash if necessary
  const route = options.path.substring(options.path.indexOf(" ") + 1).trim().replace(/^\//, "");
  const method = options.path.substring(0, options.path.indexOf(" ")).trim().toLowerCase();

  if (typeof (options.body) === "object" && !Buffer.isBuffer(options.body)) {
    debug("Request body: ", JSON.stringify(options.body, null, 2));
  }

  const url = options.baseRequestUrl + "1.0" + (route.length === 0 ? "" : "/") + route;

  const reqParams: AxiosRequestConfig = {
    method,
    url,
    headers: {
      Host: "",
    },
  };

  if (["PUT", "POST", "PATCH"].includes(method.toUpperCase())) {
    reqParams.data = JSON.stringify(options.body);
  }

  type ResponseType = AxiosResponse<ISyncResponseBody<T> | IASyncResponseBody<T> | IErrorResponseBody | IOperationMetadata<T>>;

  const res: ResponseType = await axios(url, reqParams);

  if (res.status > 399) {
    throw new OperationError(`Error '${res.statusText}' when fetching URL '${url}'`, res.statusText, res.status);
  }

  const body = res.data;

  // log finished request
  debug(`Response from ${url}:\n\n${JSON.stringify(body, null, 2)}`);

  if (isResponseBody(body)) {
    switch (body.type) {
      case "async":
        return handleAsyncResponse(body, options);
      case "sync":
        return body.metadata;
      case "error":
        throw new OperationError("Error response returned.", body.error, body.error_code);
      default:
        debug(body);
        throw new Error("unknown operation type: " + (body as any).type);
    }
  } else {
    return body.metadata;
  }
}

function isResponseBody<T>(arg: any): arg is (ISyncResponseBody<T> | IASyncResponseBody<T> | IErrorResponseBody) {
  return !!arg.type;
}

async function handleAsyncResponse<T, RequestBodyType>(body: IASyncResponseBody<T>, options: IRequestOptions<RequestBodyType>): Promise<IOperationMetadata<T>> {
  // wait for operation
  if (options.waitForOperationCompletion) {
    const strippedOptions = Object.keys(options).reduce(
      (prev: any, key) => {
        if (key !== "path" && key !== "body") {
          prev[key] = (options as any)[key];
        } else {
          return prev;
        }
      },
      {},
    );

    const newOptions: IRequestOptions<never> = {
      ...strippedOptions,
      path: "GET /operations/" + body.metadata.id + "/wait",
    };

    return request<never, IOperationMetadata<T>>(newOptions) as Promise<IOperationMetadata<T>>;
  } else {
    return body.metadata;
  }
}

export default request;
