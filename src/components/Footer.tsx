import whatsappIcon from '@/assets/whatsapp-icon.png';

const Footer = () => {
  return (
    <footer className="bg-primary/95 text-primary-foreground py-4 backdrop-blur-sm">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm font-medium">@DRT2026</p>
          <a 
            href="https://wa.me/6285156526862" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm hover:text-primary-foreground/80 transition-colors"
          >
            <img src={whatsappIcon} alt="WhatsApp" className="w-5 h-5" />
            <span>CS DRT</span>
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
