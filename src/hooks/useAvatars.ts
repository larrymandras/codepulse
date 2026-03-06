import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useAvatars() {
  return useQuery(api.avatars.list) ?? [];
}

export function useAvatarMutations() {
  const create = useMutation(api.avatars.create);
  const update = useMutation(api.avatars.update);
  const generateUploadUrl = useMutation(api.avatars.generateUploadUrl);
  const saveImage = useMutation(api.avatars.saveImage);
  return { create, update, generateUploadUrl, saveImage };
}
