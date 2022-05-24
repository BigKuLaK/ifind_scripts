interface DateTime {
  formatGranularTime: (
    milliseconds: number,
    expressive?: boolean,
    omitSeconds?: boolean
  ) => string;
}


declare module "ifind-utils" {
  export const dateTime: DateTime
}


