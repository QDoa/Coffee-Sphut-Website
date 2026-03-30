"use client";
import { toast } from "sonner";
import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { Input } from "@/components/ui/input"
import { sendDeleteAccountRequest } from "@/app/delete-account/server";


function DeleteAccountButton() {
  const { pending } = useFormStatus();
  
  return (
    <button 
      type='submit'
      className="bg-primary text-white px-4 py-2 my-2 rounded hover:bg-primary/80"
    >
      {pending ? "Processing...": "Delete Account"}
    </button>
  )
}

export default function DeleteAccountPage() {
  const formRef = useRef<HTMLFormElement>(null);
  async function handleDeleteAccount(formData: FormData) {
    try {
      const result = await sendDeleteAccountRequest(formData);
      
      // Check if subscription was successful
      if (!result.error) {
        // Show success toast
        toast.success("You've successful requeseted your account to be deleted");
        
        // Clear the email input
        formRef.current?.reset();
      }
    } catch (error) {
      console.error("Error:", error);
      // No error toast (as per requirement)
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
