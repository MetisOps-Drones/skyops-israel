"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { updateProfileDetails, uploadAvatar } from "@/actions/profile";

export function useUpdateProfileDetails() {
  const router = useRouter();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Parameters<typeof updateProfileDetails>[0]) => {
      const result = await updateProfileDetails(input);
      if (!result.success) throw new Error(result.error ?? "העדכון נכשל");
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my_global_role"] });
      router.refresh();
    },
  });
}

export function useUploadAvatar() {
  const router = useRouter();
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.set("file", file);
      const result = await uploadAvatar(formData);
      if (!result.success) throw new Error(result.error ?? "העלאת התמונה נכשלה");
      return result;
    },
    onSuccess: () => {
      router.refresh();
    },
  });
}
