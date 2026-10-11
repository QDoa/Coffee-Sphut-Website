"use client";
import { toast } from "sonner";
import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { sendDeleteAccountRequest } from "@/app/delete-account/server";


function DeleteAccountButton() {
  const { pending } = useFormStatus();
  
  return (
    <Button type='submit' className="my-2" disabled={pending}>
      {pending ? "Processing...": "Delete Account"}
    </Button>
  )
}

export default function DeleteAccountPage() {
  const formRef = useRef<HTMLFormElement>(null);
  async function handleDeleteAccount(formData: FormData) {
    try {
      const result = await sendDeleteAccountRequest(formData);
      
      if (!result.error) {
        toast.success("You've successfully requested your account to be deleted.");
        formRef.current?.reset();
      } else {
        toast.error("Failed to submit account deletion request. Please try again.");
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to submit account deletion request. Please try again.");
    }
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className='gap-6'>
          <h1 className="text-2xl font-bold">Delete Account</h1>
          <p className="text-sm text-muted-foreground">Are you sure you want to delete your account? This action cannot be undone.</p>
          <form ref={formRef} action={handleDeleteAccount} className="w-full py-2 items-center">
            <Input required className="my-1" type='email' placeholder="Email" name='email'/>
            <Input required className="my-1" type='text' placeholder="First Name" name='first_name'/>
            <Input required className="my-1" type='text' placeholder="Last Name" name='last_name'/>
            <DeleteAccountButton />
          </form>
        </div>
      </div>
    </div>
  )
}
