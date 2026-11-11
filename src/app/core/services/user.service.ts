import { Injectable } from "@angular/core";
import { environment } from "../../../environments/environment";
import { decrypt } from "../../shared/utils/util-encrypt";

const path = environment.TERCEROS_SERVICE;

@Injectable({
  providedIn: "root",
})
export class UserService {
  constructor() {}

  public getPersonaId(): Promise<number> {
    return new Promise((resolve, reject) => {
      const strcryptedId = localStorage.getItem("persona_id");
      const strId = decrypt(strcryptedId);
      if (strId) {
        resolve(parseInt(strId, 10));
      } else {
        reject(new Error("No id found"));
      }
    });
  }
}
