import { IProfileMetadata } from "./model";
import Client from "./Client";

export class Profile {
  private _metadata: IProfileMetadata;
  private _client: Client;

  /**
   * Gets the metadata for this profile.
   */
  public get metadata(): IProfileMetadata {
    return this._metadata;
  }

  /**
   * Gets the profile name
   */
  public get name() {
      return this._metadata.name;
  }

  /**
   * Creates a profile.
   * @param client
   * @param metadata
   */
  constructor(client: Client, metadata: IProfileMetadata) {
    this._client = client;
    this._metadata = metadata;
  }

  /**
   * Sets the profile name
   * @param name
   */
  public async setName(name: string): Promise<void> {
    await this._client.request<{ name: string }, never>({
      path: "POST /profiles/" + this.name,
      body: { name },
    });

    this._metadata.name = name;
  }

  /**
   * Delete the profile.
   */
  public async delete(): Promise<void> {
    await this._client.request({ path: "DELETE /profiles/" + this.name });
  }

  /**
   * Refreshes the profile information.
   */
  public async refresh(): Promise<IProfileMetadata> {
    const metadata = await this._client.request<never, IProfileMetadata>({
      path: "GET /profiles/" + this._metadata.name,
    }) as IProfileMetadata;
    this._metadata = metadata;
    return metadata;
  }
}

export default Profile;

// export
module.exports = Profile;
