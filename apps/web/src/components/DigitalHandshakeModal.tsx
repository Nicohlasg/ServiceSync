import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Handshake, AlertTriangle, MessageSquare, PenTool } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { stagger, staggerItem, fade } from "@/lib/motion";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";

interface DigitalHandshakeModalProps {
    isOpen: boolean;
    onClose: () => void;
    clientName: string;
    totalAmount: number;
    depositAmount: number;
    onConfirm: (finalCashCollected: number) => void;
}

export function DigitalHandshakeModal({
    isOpen,
    onClose,
    clientName,
    totalAmount,
    depositAmount,
    onConfirm
}: DigitalHandshakeModalProps) {
    const prefersReducedMotion = useReducedMotion();
    // Stagger children on modal open. Reduced-motion users get a flat fade.
    const containerVariants = prefersReducedMotion ? fade : stagger;
    const itemVariants = prefersReducedMotion ? fade : staggerItem;

    const defaultBalance = totalAmount - depositAmount;
    const [cashCollected, setCashCollected] = useState<string>(defaultBalance.toString());
    const [step, setStep] = useState<"adjust" | "signature" | "sending">("adjust");
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasSignature, setHasSignature] = useState(false);

    // High ticket threshold
    const needsSignature = parseFloat(cashCollected || "0") > 500;

    const handleAdjust = (amount: number) => {
        const current = parseFloat(cashCollected || "0");
        setCashCollected(Math.max(0, current + amount).toString());
    };

    const handleNext = () => {
        if (needsSignature && step === "adjust") {
            setStep("signature");
        } else {
            startHandshake();
        }
    };

    const startHandshake = () => {
        setStep("sending");

        // Simulating WhatsApp API call & Escrow Release
        setTimeout(() => {
            toast.success("Digital Handshake Complete!", {
                description: `WhatsApp receipt sent to ${clientName}. Escrow deposit of ${formatCurrency(depositAmount)} released to your bank.`
            });
            onConfirm(parseFloat(cashCollected));
        }, 2000);
    };

    // Canvas Drawing Logic
    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        setIsDrawing(true);
        draw(e);
    };

    const stopDrawing = () => {
        setIsDrawing(false);
        if (canvasRef.current) {
            const ctx = canvasRef.current.getContext("2d");
            if (ctx) {
                ctx.beginPath();
            }
        }
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        if (!isDrawing || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.strokeStyle = "#1e293b"; // slate-800

        const rect = canvas.getBoundingClientRect();
        let x, y;

        if ('touches' in e) {
            x = e.touches[0].clientX - rect.left;
            y = e.touches[0].clientY - rect.top;
        } else {
            x = e.clientX - rect.left;
            y = e.clientY - rect.top;
        }

        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y);
        setHasSignature(true);
    };

    const clearSignature = () => {
        if (canvasRef.current) {
            const ctx = canvasRef.current.getContext("2d");
            if (ctx) {
                ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                setHasSignature(false);
            }
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent aria-describedby={undefined} className="sm:max-w-md bg-white rounded-3xl overflow-hidden p-0 border-0 shadow-2xl">

                {step === "adjust" && (
                    <motion.div
                        variants={containerVariants}
                        initial="hidden"
                        animate="show"
                    >
                        <motion.div variants={itemVariants} className="bg-emerald-500 p-6 text-white text-center">
                            <div className="mx-auto bg-white/20 w-12 h-12 rounded-full flex items-center justify-center mb-3">
                                <Handshake className="h-6 w-6" />
                            </div>
                            <DialogTitle className="text-2xl font-bold tracking-tight">Cash Reconciliation</DialogTitle>
                            <DialogDescription className="text-emerald-100 mt-1">
                                Confirm the amount you received from {clientName}.
                            </DialogDescription>
                        </motion.div>

                        <div className="p-6 space-y-6">
                            {/* Calculation breakdown */}
                            <motion.div variants={itemVariants} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2">
                                <div className="flex justify-between text-sm text-slate-500">
                                    <span>Total Invoice</span>
                                    <span>{formatCurrency(totalAmount)}</span>
                                </div>
                                <div className="flex justify-between text-sm text-slate-500">
                                    <span>Less: Escrow Deposit (Paid)</span>
                                    <span className="text-emerald-600 font-medium">-{formatCurrency(depositAmount)}</span>
                                </div>
                                <div className="h-px bg-slate-200 w-full my-2" />
                                <div className="flex justify-between font-bold text-slate-800">
                                    <span>Balance Due</span>
                                    <span>{formatCurrency(defaultBalance)}</span>
                                </div>
                            </motion.div>

                            <motion.div variants={itemVariants} className="space-y-3">
                                <Label className="text-slate-700 font-bold">Did you collect exactly {formatCurrency(defaultBalance)}?</Label>

                                <div className="flex items-center gap-3">
                                    <Button variant="outline" size="icon" className="h-12 w-12 rounded-xl border-slate-200" onClick={() => handleAdjust(-5)}>
                                        -5
                                    </Button>
                                    <div className="relative flex-1">
                                        <span className="absolute left-4 top-3.5 text-slate-400 font-bold">$</span>
                                        <Input
                                            value={cashCollected}
                                            onChange={(e) => setCashCollected(e.target.value)}
                                            className="h-12 pl-8 text-xl font-bold text-center border-slate-200 rounded-xl"
                                            type="number"
                                        />
                                    </div>
                                    <Button variant="outline" size="icon" className="h-12 w-12 rounded-xl border-slate-200" onClick={() => handleAdjust(5)}>
                                        +5
                                    </Button>
                                </div>
                                {parseFloat(cashCollected) !== defaultBalance && (
                                    <p className="text-xs text-orange-500 flex items-center gap-1 mt-1">
                                        <AlertTriangle className="h-3 w-3" /> Adjusted from expected balance.
                                    </p>
                                )}
                                {needsSignature && (
                                    <p className="text-xs text-blue-500 flex items-center gap-1 mt-1 bg-blue-50 p-2 rounded-lg">
                                        <PenTool className="h-3 w-3" /> Amounts over $500 require client signature next.
                                    </p>
                                )}
                            </motion.div>
                        </div>

                        <motion.div variants={itemVariants}>
                            <DialogFooter className="p-6 pt-0 sm:justify-center">
                                <Button
                                    onClick={handleNext}
                                    className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-lg shadow-lg shadow-emerald-500/25"
                                >
                                    {needsSignature ? "Proceed to Sign" : "Confirm & Send Receipt"}
                                </Button>
                            </DialogFooter>
                        </motion.div>
                    </motion.div>
                )}

                {step === "signature" && (
                    <motion.div
                        variants={containerVariants}
                        initial="hidden"
                        animate="show"
                    >
                        <motion.div variants={itemVariants} className="bg-slate-900 p-6 text-white text-center">
                            <DialogTitle className="text-2xl font-bold tracking-tight text-white mb-2">Sign to Confirm</DialogTitle>
                            <p className="text-slate-300 text-sm">
                                Please ask the client to sign below to confirm handing over <span className="font-bold text-emerald-400">{formatCurrency(parseFloat(cashCollected))}</span> in cash.
                            </p>
                        </motion.div>
                        <motion.div variants={itemVariants} className="p-6">
                            <div className="border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50 relative overflow-hidden h-48 w-full touch-none">
                                <canvas
                                    ref={canvasRef}
                                    width={400} // Approximate modal width
                                    height={200}
                                    className="w-full h-full cursor-crosshair touch-none"
                                    onMouseDown={startDrawing}
                                    onMouseUp={stopDrawing}
                                    onMouseOut={stopDrawing}
                                    onMouseMove={draw}
                                    onTouchStart={startDrawing}
                                    onTouchEnd={stopDrawing}
                                    onTouchMove={draw}
                                />
                                {!hasSignature && (
                                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-slate-300 font-medium">
                                        Sign here
                                    </div>
                                )}
                            </div>
                            <div className="flex justify-end mt-2">
                                <Button variant="ghost" size="sm" onClick={clearSignature} className="text-slate-500 hover:text-slate-700">Clear</Button>
                            </div>
                        </motion.div>
                        <motion.div variants={itemVariants}>
                            <DialogFooter className="p-6 pt-0 sm:justify-center gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => setStep("adjust")}
                                    className="w-1/3 h-12 rounded-xl border-slate-200"
                                >
                                    Back
                                </Button>
                                <Button
                                    onClick={startHandshake}
                                    disabled={!hasSignature}
                                    className="flex-1 h-12 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-lg"
                                >
                                    Confirm Receipt
                                </Button>
                            </DialogFooter>
                        </motion.div>
                    </motion.div>
                )}

                {step === "sending" && (
                    <div className="p-12 text-center space-y-4">
                        <div className="relative mx-auto w-20 h-20">
                            <div className="absolute inset-0 border-4 border-slate-100 rounded-full" />
                            <div className="absolute inset-0 border-4 border-emerald-500 rounded-full border-t-transparent animate-spin" />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <MessageSquare className="h-8 w-8 text-emerald-500 animate-pulse" />
                            </div>
                        </div>
                        <h3 className="text-xl font-bold text-slate-800">Initiating Handshake...</h3>
                        <p className="text-slate-500 text-sm">
                            Sending WhatsApp E-Receipt to the client and releasing their escrow deposit to your bank.
                        </p>
                    </div>
                )}

            </DialogContent>
        </Dialog>
    );
}
