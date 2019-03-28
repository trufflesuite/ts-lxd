export type MetadataStatus =
 "Operation Created" |
  "Started" |
  "Stopped" |
  "Running" |
  "Cancelling" |
  "Pending" |
  "Starting" |
  "Stopping" |
  "Aborting" |
  "Freezing" |
  "Frozen" |
  "Thawed" |
  "Success" |
  "Failure" |
  "Cancelled";

export type MetadataStatusCode =
  100 |
  101 |
  102 |
  103 |
  104 |
  105 |
  106 |
  107 |
  108 |
  109 |
  110 |
  111 |
  200 |
  400 |
  401;

// TODO
// export interface IMetadataResourcesMap { }

export interface IBaseResponseBody<Metadata> {
  type: "sync" | "async";
  status: "Success";
  status_code: MetadataStatusCode;
  metadata: Metadata;
}

export interface ISyncResponseBody<Metadata> extends IBaseResponseBody<Metadata> {
  type: "sync";
}

export interface IASyncResponseBody<Metadata> extends IBaseResponseBody<IOperationMetadata<Metadata>> {
  type: "async";
  operation: string;
}

export interface IErrorResponseBody {
  type: "error";
  error: "Failure";
  error_code: MetadataStatusCode;
  // this type technically does have a `metadata` object, but we never actually use it, so it's commented out
  // metadata: any
}

export interface IOperationMetadata<OperationMetadataType> {
  /**
   * UUID of this operation
   */
  id: string;

  /**
   * Class of operation. Either "task", "websocket", or "token"
   */
  class: "task" | "websocket" | "token";

  /**
   * ISO8601 timestamp, when the operation was created
   */
  created_at: string;

  /**
   * ISO8601 timestamp, when the operation was last updated
   */
  updated_at: string;

  /**
   * String version of the operation's status
   */
  status: MetadataStatus;

  /**
   * Numeric version of the operation's status
   */
  status_code: MetadataStatusCode;

  // TODO
  /**
   * Dictionary of resource types (container, snapshots, images) and affected resources
   */
  // resources: IMetadataResourcesMap;

  /**
   * Metadata specific to the operation in question.
   */
  metadata: OperationMetadataType;

  /**
   * Whether the operation can be canceled (DELETE over REST)
   */
  may_cancel: boolean;

  /**
   * The error string, should the operation have failed
   */
  err?: string;
}

export interface IUntrustedInfoMetadata {
  api_extensions: string[];
  api_status: "stable" | "development" | "deprecated";
  api_version: "1.0";
  auth: "guest" | "untrusted" | "trusted";
  public: boolean;
}

export interface ITrustedInfoMetadata extends IUntrustedInfoMetadata {
  config: {
    "core.trust_password": boolean;
    "core.https_address": string;
  };
  auth: "trusted";
  auth_methods: string[];
  environment: {
    addresses: string[];
    architectures: string[];
    certificate: string;
    certificate_fingerprint: string;
    kernel: string;
    kernel_architecture: string;
    kernel_version: string;
    server: string;
    server_pid: number;
    server_version: string;
    storage: string;
    storage_version: string;
    server_clustered: boolean;
    server_name: string;
  };
  certificate: string;
  certificate_fingerprint: string;
  driver: string;
  driver_version: string;
  kernel: string;
  kernel_architecture: string;
  kernel_version: string;
  server: "lxd";
  server_pid: number;
  server_version: string;
  storage: string;
  storage_version: string;
  server_clustered: boolean;
  server_name: string;
  project: string;
}

export type IContainersMetadata = string[];

export interface IContainerMetadata {
  architecture: string;
  config: {
    "image.architecture": string;
    "image.description": string;
    "image.label": string;
    "image.os": string;
    "image.release": string;
    "image.serial": string;
    "image.version": string;
    [key: string]: string
  };
  devices: {};
  ephemeral: boolean;
  profiles: string[];
  stateful: boolean;
  description: string;
  created_at: string;
  expanded_config: {
    [key: string]: string;
  };
  expanded_devices: {
    [key: string]: {
      [key: string]: string;
    };
  };
  name: string;
  status: MetadataStatus;
  status_code: MetadataStatusCode;
  last_used_at: string;
  location: string;
}

export interface INetworkAddress {
  family: string;
  address: string;
  netmask: string;
  scope: string;
}

export interface INetworkCounter {
  bytes_received: number;
  bytes_sent: number;
  packets_received: number;
  packets_sent: number;
}

export interface IContainerStateMetadata {
  status: MetadataStatus;
  status_code: MetadataStatusCode;
  pid: number;
  processes: number;
  cpu: {
    usage: number;
  };
  disk: {
    [key: string]: {
      usage: number;
    };
  };
  memory: {
    usage: number;
    usage_peak: number;
    swap_usage: number;
    swap_usage_peak: number;
  };
  network: {
    [key: string]: {
      addresses: INetworkAddress[];
      counters: INetworkCounter[];
      hwaddr: string;
      host_name: string;
      mtu: number;
      state: string;
      type: string;
    };
  };
}

export type IProfilesMetadata = string[];

export interface IProfileMetadata {
  name: string;
  description: string;
  config: {
    [key: string]: string;
  };
  devices: {
    [key: string]: {
      path: string;
      type: string;
    };
  };
  used_by: string[];
}

export interface IAuthorizeCertificateRequest {
  type: "client";
  certificate?: string;
  name?: string;
  password?: string;
}

export interface IUpdateContainerNameRequest {
  name: string;
}

export interface IContainerExecRequest {
  command: string[];
  environment?: {
    [key: string]: string;
  };
  "wait-for-websocket": boolean;
  "record-output": boolean;
  interactive: boolean;
  width?: number;
  height?: number;
}

export interface IExecOperationMetadata {
  output?: {
    [key: string]: string;
  };
  fds?: {
    [key: string]: string;
  };
  return?: number;
}

export interface IContainerStateRequest {
  /**
   * State change action (stop, start, restart, freeze or unfreeze)
   */
  action: "stop" | "start" | "restart" | "freeze" | "unfreeze";

  /**
   * A timeout after which the state change is considered as failed
   */
  timeout: number;

  /**
   * Force the state change (currently only valid for stop and restart where it means killing the container)
   */
  force: boolean;

  /**
   * Whether to store or restore runtime state before stopping or starting (only valid for stop and start, defaults to false)
   */
  stateful: boolean;
}
