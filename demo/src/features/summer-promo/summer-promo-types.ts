/** Input for building the summer banner; the promotion takes no options. */
export interface BuildBannerInput {}

/** The seasonal banner: the flavors on promotion and the copy to show. */
export interface SummerBanner {
  flavors: string[];
  bannerText: string;
}
