from pydantic import BaseModel, Field


class ProductPrice(BaseModel):
    currency: str | None = None
    amount: float | None = None
    tax_rate: float | None = Field(None, alias="taxRate")

    def display(self) -> str:
        if self.amount is None or self.currency is None:
            return "price unavailable"
        return f"{self.amount} {self.currency}"


class Product(BaseModel):
    id: str
    title: str
    slug: str | None = None
    description: str | None = None
    short_description: str | None = Field(default=None, alias="shortDescription")
    benefits: list[str] = Field(default_factory=list)
    health_goals: list[str] = Field(default_factory=list, alias="healthGoals")
    nutrition_info: str | None = Field(default=None, alias="nutritionInfo")
    how_to_use: str | None = Field(default=None, alias="howToUse")
    price: ProductPrice | None = None

    model_config = {"populate_by_name": True}

    def to_prompt_snippet(self) -> str:
        """Generate a detailed snippet for AI context about this product."""
        parts = [f"**{self.title}**"]
        
        if self.short_description:
            parts.append(f"Description: {self.short_description}")
        elif self.description:
            # Use first 150 chars of description if shortDescription not available
            desc = self.description[:150] + "..." if len(self.description) > 150 else self.description
            parts.append(f"Description: {desc}")
        
        if self.health_goals:
            goals = ", ".join(self.health_goals)
            parts.append(f"Health Goals: {goals}")
        
        if self.benefits:
            benefits = "; ".join(self.benefits[:4])  # Limit to 4 most important benefits
            parts.append(f"Key Benefits: {benefits}")
        
        if self.price:
            parts.append(f"Price: {self.price.display()}")
        
        if self.how_to_use:
            parts.append(f"How to Use: {self.how_to_use}")
        
        return " | ".join(parts)
