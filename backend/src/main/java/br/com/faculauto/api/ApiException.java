package br.com.faculauto.api;

public final class ApiException extends RuntimeException {
    private final int status;
    private final String code;

    public ApiException(int status, String message) {
        this(status, message, null);
    }

    public ApiException(int status, String message, String code) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public int status() { return status; }
    public String code() { return code; }

    public static ApiException submissionUnknown(int status) {
        return new ApiException(status,
                "O resultado da entrega é desconhecido. Confira o recibo diretamente no Canvas antes de qualquer nova tentativa.",
                "SUBMISSION_UNKNOWN");
    }
}
